-- Phase 1: add PostGIS-backed spatial columns and indexes while preserving existing lat/lng fields.
-- Phase 2: use PostGIS for authoritative geofence checks on incoming trip points.

create extension if not exists postgis;

create or replace function public.geofence_geojson_to_geom(p_geojson jsonb)
returns geometry
language plpgsql
immutable
as $$
declare
  v_type text;
  v_item jsonb;
  v_candidate geometry;
  v_result geometry;
begin
  if p_geojson is null or jsonb_typeof(p_geojson) <> 'object' then
    return null;
  end if;

  v_type := p_geojson ->> 'type';

  if v_type = 'Feature' then
    return public.geofence_geojson_to_geom(p_geojson -> 'geometry');
  end if;

  if v_type = 'FeatureCollection' then
    for v_item in
      select value from jsonb_array_elements(coalesce(p_geojson -> 'features', '[]'::jsonb))
    loop
      v_candidate := public.geofence_geojson_to_geom(v_item);
      if v_candidate is not null then
        v_result := case
          when v_result is null then v_candidate
          else ST_Collect(v_result, v_candidate)
        end;
      end if;
    end loop;

    if v_result is null then
      return null;
    end if;

    return ST_MakeValid(ST_SetSRID(ST_CollectionExtract(v_result, 3), 4326));
  end if;

  if v_type = 'GeometryCollection' then
    for v_item in
      select value from jsonb_array_elements(coalesce(p_geojson -> 'geometries', '[]'::jsonb))
    loop
      v_candidate := public.geofence_geojson_to_geom(v_item);
      if v_candidate is not null then
        v_result := case
          when v_result is null then v_candidate
          else ST_Collect(v_result, v_candidate)
        end;
      end if;
    end loop;

    if v_result is null then
      return null;
    end if;

    return ST_MakeValid(ST_SetSRID(ST_CollectionExtract(v_result, 3), 4326));
  end if;

  if v_type in ('Polygon', 'MultiPolygon') then
    return ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson::text), 4326));
  end if;

  return null;
exception when others then
  return null;
end;
$$;

alter table if exists public.routes
add column if not exists geofence_geom geometry(Geometry, 4326);

update public.routes
set geofence_geom = public.geofence_geojson_to_geom(geofence_geojson)
where geofence_geojson is not null
  and geofence_geom is null;

create or replace function public.set_route_geofence_geom()
returns trigger
language plpgsql
as $$
begin
  new.geofence_geom := public.geofence_geojson_to_geom(new.geofence_geojson);
  return new;
end;
$$;

drop trigger if exists trg_routes_geofence_geom on public.routes;
create trigger trg_routes_geofence_geom
before insert or update of geofence_geojson on public.routes
for each row execute function public.set_route_geofence_geom();

alter table if exists public.trip_points
add column if not exists location geometry(Point, 4326) generated always as (
  ST_SetSRID(ST_MakePoint(lng, lat), 4326)
) stored;

alter table if exists public.driver_locations
add column if not exists location geometry(Point, 4326) generated always as (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
) stored;

alter table if exists public.violations
add column if not exists location geometry(Point, 4326) generated always as (
  case
    when latitude is null or longitude is null then null
    else ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
  end
) stored;

alter table if exists public.mobile_violations
add column if not exists location geometry(Point, 4326) generated always as (
  case
    when latitude is null or longitude is null then null
    else ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
  end
) stored;

alter table if exists public.emergency_alerts
add column if not exists passenger_location geometry(Point, 4326) generated always as (
  case
    when passenger_latitude is null or passenger_longitude is null then null
    else ST_SetSRID(ST_MakePoint(passenger_longitude, passenger_latitude), 4326)
  end
) stored;

create index if not exists idx_routes_geofence_geom_gist
on public.routes using gist(geofence_geom)
where geofence_geom is not null;

create index if not exists idx_trip_points_location_gist
on public.trip_points using gist(location);

create index if not exists idx_driver_locations_location_gist
on public.driver_locations using gist(location);

create index if not exists idx_violations_location_gist
on public.violations using gist(location)
where location is not null;

create index if not exists idx_mobile_violations_location_gist
on public.mobile_violations using gist(location)
where location is not null;

create index if not exists idx_emergency_alerts_passenger_location_gist
on public.emergency_alerts using gist(passenger_location)
where passenger_location is not null;

create or replace function public.create_geofence_violation_from_trip_point()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_inside boolean;
  v_geofence geometry;
  v_bucket bigint;
  v_dedupe_key text;
  v_route_label text;
  v_location_label text;
begin
  if new.trip_id is null then
    return new;
  end if;

  select
    t.trip_id,
    t.driver_id,
    t.tricycle_id,
    r.route_id,
    r.origin,
    r.destination,
    r.geofence_geojson,
    r.geofence_geom
  into v_context
  from public.trips t
  join public.routes r
    on r.route_id = t.route_id
  where t.trip_id = new.trip_id
    and t.driver_id = new.driver_id
  limit 1;

  if v_context.trip_id is null then
    return new;
  end if;

  v_geofence := coalesce(
    v_context.geofence_geom,
    public.geofence_geojson_to_geom(v_context.geofence_geojson)
  );

  if v_geofence is null then
    return new;
  end if;

  v_inside := ST_Covers(
    v_geofence,
    coalesce(new.location, ST_SetSRID(ST_MakePoint(new.lng, new.lat), 4326))
  );
  if v_inside is distinct from false then
    return new;
  end if;

  v_bucket := floor(extract(epoch from coalesce(new.recorded_at, now())) / 300)::bigint;
  v_dedupe_key := concat('geofence-boundary:', new.trip_id, ':', new.driver_id, ':', v_bucket);
  v_route_label := concat_ws(' -> ', v_context.origin, v_context.destination);
  v_location_label := concat(round(new.lat::numeric, 5)::text, ', ', round(new.lng::numeric, 5)::text);

  insert into public.mobile_violations (
    driver_id,
    trip_id,
    type,
    status,
    priority,
    occurred_at,
    title,
    latitude,
    longitude,
    location_label,
    details,
    dedupe_key
  )
  values (
    new.driver_id,
    new.trip_id,
    'GEOFENCE_BOUNDARY',
    'OPEN',
    'HIGH',
    coalesce(new.recorded_at, now()),
    'Geofence Boundary Violation',
    new.lat,
    new.lng,
    v_location_label,
    concat(
      'Backend geofence validation detected a trip point outside the authorized route boundary.',
      case when v_route_label <> '' then concat(' Route: ', v_route_label, '.') else '' end
    ),
    v_dedupe_key
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  return new;
end;
$$;

drop trigger if exists trg_trip_points_geofence_violation on public.trip_points;
create trigger trg_trip_points_geofence_violation
after insert on public.trip_points
for each row execute function public.create_geofence_violation_from_trip_point();

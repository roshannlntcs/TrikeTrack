-- Day 2: backend/Supabase-authoritative geofence violation creation.
-- Run after add_mobile_shared_tables.sql.

alter table if exists public.mobile_violations
add column if not exists dedupe_key text;

create unique index if not exists uq_mobile_violations_dedupe_key
on public.mobile_violations(dedupe_key)
where dedupe_key is not null;

create or replace function public._geojson_ring_contains_lnglat(
  p_ring jsonb,
  p_lng double precision,
  p_lat double precision
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_inside boolean := false;
  v_count integer;
  v_i integer;
  v_j integer;
  v_xi double precision;
  v_yi double precision;
  v_xj double precision;
  v_yj double precision;
begin
  if p_ring is null or jsonb_typeof(p_ring) <> 'array' then
    return false;
  end if;

  v_count := jsonb_array_length(p_ring);
  if v_count < 4 then
    return false;
  end if;

  v_j := v_count - 1;
  for v_i in 0..(v_count - 1) loop
    v_xi := (p_ring -> v_i ->> 0)::double precision;
    v_yi := (p_ring -> v_i ->> 1)::double precision;
    v_xj := (p_ring -> v_j ->> 0)::double precision;
    v_yj := (p_ring -> v_j ->> 1)::double precision;

    if ((v_yi > p_lat) <> (v_yj > p_lat))
      and (
        p_lng < ((v_xj - v_xi) * (p_lat - v_yi) / nullif(v_yj - v_yi, 0)) + v_xi
      )
    then
      v_inside := not v_inside;
    end if;

    v_j := v_i;
  end loop;

  return v_inside;
exception
  when others then
    return false;
end;
$$;

create or replace function public._geojson_polygon_contains_lnglat(
  p_coordinates jsonb,
  p_lng double precision,
  p_lat double precision
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_ring_count integer;
  v_i integer;
begin
  if p_coordinates is null or jsonb_typeof(p_coordinates) <> 'array' then
    return null;
  end if;

  v_ring_count := jsonb_array_length(p_coordinates);
  if v_ring_count = 0 then
    return null;
  end if;

  if not public._geojson_ring_contains_lnglat(p_coordinates -> 0, p_lng, p_lat) then
    return false;
  end if;

  if v_ring_count > 1 then
    for v_i in 1..(v_ring_count - 1) loop
      if public._geojson_ring_contains_lnglat(p_coordinates -> v_i, p_lng, p_lat) then
        return false;
      end if;
    end loop;
  end if;

  return true;
end;
$$;

create or replace function public.geojson_contains_lnglat(
  p_geojson jsonb,
  p_lng double precision,
  p_lat double precision
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_type text;
  v_item jsonb;
  v_result boolean;
  v_seen_valid boolean := false;
begin
  if p_geojson is null or jsonb_typeof(p_geojson) <> 'object' then
    return null;
  end if;

  v_type := p_geojson ->> 'type';

  if v_type = 'Feature' then
    return public.geojson_contains_lnglat(p_geojson -> 'geometry', p_lng, p_lat);
  end if;

  if v_type = 'FeatureCollection' then
    for v_item in
      select value from jsonb_array_elements(coalesce(p_geojson -> 'features', '[]'::jsonb))
    loop
      v_result := public.geojson_contains_lnglat(v_item, p_lng, p_lat);
      if v_result is true then
        return true;
      end if;
      if v_result is not null then
        v_seen_valid := true;
      end if;
    end loop;

    if v_seen_valid then
      return false;
    end if;
    return null;
  end if;

  if v_type = 'Polygon' then
    return public._geojson_polygon_contains_lnglat(p_geojson -> 'coordinates', p_lng, p_lat);
  end if;

  if v_type = 'MultiPolygon' then
    for v_item in
      select value from jsonb_array_elements(coalesce(p_geojson -> 'coordinates', '[]'::jsonb))
    loop
      v_result := public._geojson_polygon_contains_lnglat(v_item, p_lng, p_lat);
      if v_result is true then
        return true;
      end if;
      if v_result is not null then
        v_seen_valid := true;
      end if;
    end loop;

    if v_seen_valid then
      return false;
    end if;
    return null;
  end if;

  return null;
end;
$$;

create or replace function public.create_geofence_violation_from_trip_point()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_inside boolean;
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
    r.geofence_geojson
  into v_context
  from public.trips t
  join public.routes r
    on r.route_id = t.route_id
  where t.trip_id = new.trip_id
    and t.driver_id = new.driver_id
  limit 1;

  if v_context.trip_id is null or v_context.geofence_geojson is null then
    return new;
  end if;

  v_inside := public.geojson_contains_lnglat(v_context.geofence_geojson, new.lng, new.lat);
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

do $$
begin
  begin
    alter publication supabase_realtime add table public.mobile_violations;
  exception when duplicate_object or undefined_object then null;
  end;
end $$;

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception
  when others then null;
end $$;

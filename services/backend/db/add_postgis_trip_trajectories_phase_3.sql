-- Phase 3: persist completed trip trajectories as database-native PostGIS LineStrings.
-- The existing path_geojson column is kept for API/UI compatibility.

create extension if not exists postgis;

create or replace function public.trip_path_geojson_to_line_geom(p_geojson jsonb)
returns geometry
language plpgsql
immutable
as $$
declare
  v_geometry jsonb;
begin
  if p_geojson is null or jsonb_typeof(p_geojson) <> 'object' then
    return null;
  end if;

  v_geometry := case
    when p_geojson ->> 'type' = 'Feature' then p_geojson -> 'geometry'
    else p_geojson
  end;

  if v_geometry ->> 'type' <> 'LineString'
    or jsonb_typeof(v_geometry -> 'coordinates') <> 'array'
    or jsonb_array_length(v_geometry -> 'coordinates') < 2 then
    return null;
  end if;

  return ST_SetSRID(ST_GeomFromGeoJSON(v_geometry::text), 4326);
exception when others then
  return null;
end;
$$;

alter table if exists public.trip_paths
add column if not exists route_geom geometry(LineString, 4326);

alter table if exists public.trip_paths
add column if not exists raw_point_count integer not null default 0;

alter table if exists public.trip_paths
add column if not exists matched_point_count integer not null default 0;

alter table if exists public.trip_paths
add column if not exists route_source text not null default 'saved_route';

update public.trip_paths
set
  route_geom = public.trip_path_geojson_to_line_geom(path_geojson),
  raw_point_count = greatest(
    raw_point_count,
    coalesce(nullif(path_geojson #>> '{properties,rawPointCount}', '')::integer, point_count, 0)
  ),
  matched_point_count = greatest(
    matched_point_count,
    coalesce(
      case
        when jsonb_typeof(path_geojson #> '{geometry,coordinates}') = 'array'
          then jsonb_array_length(path_geojson #> '{geometry,coordinates}')
        when jsonb_typeof(path_geojson -> 'coordinates') = 'array'
          then jsonb_array_length(path_geojson -> 'coordinates')
        else null
      end,
      point_count,
      0
    )
  ),
  route_source = coalesce(nullif(path_geojson #>> '{properties,source}', ''), route_source)
where route_geom is null
  and public.trip_path_geojson_to_line_geom(path_geojson) is not null;

create index if not exists idx_trip_paths_route_geom_gist
on public.trip_paths using gist(route_geom)
where route_geom is not null;

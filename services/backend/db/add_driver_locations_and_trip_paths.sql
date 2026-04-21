create table if not exists public.driver_locations (
  driver_id bigint primary key references public.drivers(driver_id) on delete cascade
);

alter table public.driver_locations
add column if not exists driver_code text;

alter table public.driver_locations
add column if not exists trip_id bigint references public.trips(trip_id) on delete set null;

alter table public.driver_locations
add column if not exists latitude double precision;

alter table public.driver_locations
add column if not exists longitude double precision;

alter table public.driver_locations
add column if not exists speed double precision;

alter table public.driver_locations
add column if not exists heading double precision;

alter table public.driver_locations
add column if not exists accuracy double precision;

alter table public.driver_locations
add column if not exists recorded_at timestamptz;

alter table public.driver_locations
add column if not exists is_online boolean;

alter table public.driver_locations
add column if not exists updated_at timestamptz;

update public.driver_locations
set is_online = coalesce(is_online, true),
    updated_at = coalesce(updated_at, now())
where is_online is null
   or updated_at is null;

alter table public.driver_locations
alter column driver_code set not null;

alter table public.driver_locations
alter column latitude set not null;

alter table public.driver_locations
alter column longitude set not null;

alter table public.driver_locations
alter column recorded_at set not null;

alter table public.driver_locations
alter column is_online set default true;

alter table public.driver_locations
alter column is_online set not null;

alter table public.driver_locations
alter column updated_at set default now();

alter table public.driver_locations
alter column updated_at set not null;

create index if not exists idx_driver_locations_trip_id
on public.driver_locations(trip_id);

create index if not exists idx_driver_locations_recorded_at
on public.driver_locations(recorded_at desc);

create table if not exists public.trip_paths (
  trip_path_id bigint generated always as identity primary key,
  trip_id bigint not null unique references public.trips(trip_id) on delete cascade,
  point_count integer not null default 0,
  path_geojson jsonb not null,
  started_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.trip_paths
add column if not exists point_count integer;

alter table public.trip_paths
add column if not exists path_geojson jsonb;

alter table public.trip_paths
add column if not exists started_at timestamptz;

alter table public.trip_paths
add column if not exists ended_at timestamptz;

alter table public.trip_paths
add column if not exists updated_at timestamptz;

update public.trip_paths
set point_count = coalesce(point_count, 0),
    path_geojson = coalesce(
      path_geojson,
      jsonb_build_object(
        'type', 'Feature',
        'geometry', jsonb_build_object('type', 'LineString', 'coordinates', '[]'::jsonb),
        'properties', jsonb_build_object('tripId', trip_id, 'pointCount', 0)
      )
    ),
    updated_at = coalesce(updated_at, now())
where point_count is null
   or path_geojson is null
   or updated_at is null;

alter table public.trip_paths
alter column point_count set default 0;

alter table public.trip_paths
alter column point_count set not null;

alter table public.trip_paths
alter column path_geojson set not null;

alter table public.trip_paths
alter column updated_at set default now();

alter table public.trip_paths
alter column updated_at set not null;

create index if not exists idx_trip_paths_updated_at
on public.trip_paths(updated_at desc);

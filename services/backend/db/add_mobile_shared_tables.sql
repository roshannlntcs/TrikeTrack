-- Day 1 shared schema stabilization for the admin dashboard, backend, and mobile app.
-- Run this on existing Supabase projects after services/backend/db/schema.sql becomes canonical.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  create type public.mobile_violation_type as enum (
    'GEOFENCE_BOUNDARY',
    'ROUTE_DEVIATION',
    'UNAUTHORIZED_STOP',
    'GPS_SILENCE',
    'LONG_STOP',
    'TRIP_TIMEOUT',
    'SUSPICIOUS_SPEED',
    'REPEATED_GEOFENCE_BOUNDARY'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.mobile_violation_status as enum (
    'OPEN',
    'UNDER_REVIEW',
    'RESOLVED'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.mobile_violation_priority as enum (
    'HIGH',
    'MEDIUM',
    'LOW'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.appeal_status as enum (
    'SUBMITTED',
    'UNDER_REVIEW',
    'APPROVED',
    'DENIED',
    'WITHDRAWN'
  );
exception
  when duplicate_object then null;
end $$;

create or replace function public.mobile_violation_status_from_text(p_label text)
returns public.mobile_violation_status
language plpgsql
immutable
as $$
declare
  v_status public.mobile_violation_status;
begin
  select enum_value
  into v_status
  from unnest(enum_range(null::public.mobile_violation_status)) as enum_value
  where lower(enum_value::text) = lower(trim(p_label))
  limit 1;

  if v_status is null then
    raise exception 'Invalid mobile_violation_status value: %', p_label;
  end if;

  return v_status;
end;
$$;

create or replace function public.mobile_violation_priority_from_text(p_label text)
returns public.mobile_violation_priority
language plpgsql
immutable
as $$
declare
  v_priority public.mobile_violation_priority;
begin
  select enum_value
  into v_priority
  from unnest(enum_range(null::public.mobile_violation_priority)) as enum_value
  where lower(enum_value::text) = lower(trim(p_label))
  limit 1;

  if v_priority is null then
    raise exception 'Invalid mobile_violation_priority value: %', p_label;
  end if;

  return v_priority;
end;
$$;

create or replace function public.appeal_status_from_text(p_label text)
returns public.appeal_status
language plpgsql
immutable
as $$
declare
  v_status public.appeal_status;
begin
  select enum_value
  into v_status
  from unnest(enum_range(null::public.appeal_status)) as enum_value
  where lower(enum_value::text) = lower(trim(p_label))
  limit 1;

  if v_status is null then
    raise exception 'Invalid appeal_status value: %', p_label;
  end if;

  return v_status;
end;
$$;

alter table if exists public.driver_locations
  add column if not exists trip_id bigint references public.trips(trip_id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

alter table if exists public.trips
  add column if not exists start_location_raw jsonb,
  add column if not exists start_location_matched jsonb,
  add column if not exists end_location_raw jsonb,
  add column if not exists end_location_matched jsonb,
  add column if not exists start_display_name text,
  add column if not exists end_display_name text,
  add column if not exists start_coordinate jsonb,
  add column if not exists end_coordinate jsonb,
  add column if not exists dashed_start_connector jsonb,
  add column if not exists dashed_end_connector jsonb,
  add column if not exists route_trace_geojson jsonb,
  add column if not exists trip_metrics jsonb,
  add column if not exists gps_quality_summary jsonb,
  add column if not exists raw_gps_point_count integer not null default 0,
  add column if not exists matched_point_count integer not null default 0,
  add column if not exists offline_segments_count integer not null default 0,
  add column if not exists sync_status text not null default 'SYNC_PENDING';

alter table if exists public.trip_points
  add column if not exists altitude double precision,
  add column if not exists provider text;

alter table if exists public.passenger_scans
  add column if not exists driver_id bigint references public.drivers(driver_id) on delete cascade;

alter table if exists public.passenger_scans
  alter column trip_id drop not null;

update public.passenger_scans ps
set driver_id = qr.driver_id
from public.qr_codes qr
where ps.driver_id is null
  and ps.qr_id = qr.qr_id
  and qr.driver_id is not null;

alter table if exists public.reports
  add column if not exists driver_id bigint references public.drivers(driver_id) on delete cascade,
  add column if not exists qr_id bigint references public.qr_codes(qr_id) on delete restrict,
  add column if not exists source text not null default 'qr_web_form',
  add column if not exists passenger_name text,
  add column if not exists passenger_contact text;

alter table if exists public.reports
  alter column trip_id drop not null;

update public.reports r
set
  driver_id = coalesce(r.driver_id, ps.driver_id),
  qr_id = coalesce(r.qr_id, ps.qr_id)
from public.passenger_scans ps
where r.scan_id = ps.scan_id
  and (r.driver_id is null or r.qr_id is null);

alter table if exists public.violations
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_label text,
  add column if not exists dedupe_key text;

create table if not exists public.trip_route_points (
  trip_id bigint not null references public.trips(trip_id) on delete cascade,
  idx integer not null check (idx >= 0),
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now(),
  primary key (trip_id, idx)
);

create table if not exists public.trip_routes (
  id bigint generated always as identity primary key,
  local_trip_id text not null,
  trip_id bigint references public.trips(trip_id) on delete set null,
  driver_id bigint not null references public.drivers(driver_id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  recorded_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.mobile_violations (
  id uuid primary key default gen_random_uuid(),
  driver_id bigint not null references public.drivers(driver_id) on delete cascade,
  trip_id bigint references public.trips(trip_id) on delete set null,
  type public.mobile_violation_type not null,
  status public.mobile_violation_status not null default public.mobile_violation_status_from_text('OPEN'),
  priority public.mobile_violation_priority not null default public.mobile_violation_priority_from_text('MEDIUM'),
  occurred_at timestamptz not null default now(),
  title text,
  latitude double precision,
  longitude double precision,
  location_label text,
  details text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.violation_appeals (
  id uuid primary key default gen_random_uuid(),
  violation_id uuid not null references public.mobile_violations(id) on delete cascade,
  driver_id bigint not null references public.drivers(driver_id) on delete cascade,
  reason text not null,
  details text,
  status public.appeal_status not null default public.appeal_status_from_text('SUBMITTED'),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  decision_notes text,
  admin_viewed_at timestamptz,
  admin_viewed_by_admin_id bigint references public.admin_accounts(admin_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.violation_appeals
  add column if not exists admin_viewed_at timestamptz,
  add column if not exists admin_viewed_by_admin_id bigint references public.admin_accounts(admin_id) on delete set null;

create table if not exists public.violation_proofs (
  id uuid primary key default gen_random_uuid(),
  violation_id uuid not null references public.mobile_violations(id) on delete cascade,
  driver_id bigint not null references public.drivers(driver_id) on delete cascade,
  file_url text not null,
  file_path text not null,
  file_type text,
  status text not null default 'UPLOADED',
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'drivers_tricycle_id_fkey'
      and conrelid = 'public.drivers'::regclass
  ) then
    alter table public.drivers
      add constraint drivers_tricycle_id_fkey
      foreign key (tricycle_id) references public.tricycles(tricycle_id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'drivers_qr_id_fkey'
      and conrelid = 'public.drivers'::regclass
  ) then
    alter table public.drivers
      add constraint drivers_qr_id_fkey
      foreign key (qr_id) references public.qr_codes(qr_id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'qr_codes_driver_id_fkey'
      and conrelid = 'public.qr_codes'::regclass
  ) then
    alter table public.qr_codes
      add constraint qr_codes_driver_id_fkey
      foreign key (driver_id) references public.drivers(driver_id) on delete set null;
  end if;
end $$;

drop trigger if exists trg_driver_locations_updated_at on public.driver_locations;
create trigger trg_driver_locations_updated_at
before update on public.driver_locations
for each row execute function public.set_updated_at();

drop trigger if exists trg_mobile_violations_updated_at on public.mobile_violations;
create trigger trg_mobile_violations_updated_at
before update on public.mobile_violations
for each row execute function public.set_updated_at();

drop trigger if exists trg_violation_appeals_updated_at on public.violation_appeals;
create trigger trg_violation_appeals_updated_at
before update on public.violation_appeals
for each row execute function public.set_updated_at();

drop trigger if exists trg_violation_proofs_updated_at on public.violation_proofs;
create trigger trg_violation_proofs_updated_at
before update on public.violation_proofs
for each row execute function public.set_updated_at();

create index if not exists idx_driver_locations_trip_id on public.driver_locations(trip_id);
create index if not exists idx_driver_locations_recorded_at on public.driver_locations(recorded_at desc);
create index if not exists idx_driver_locations_driver_code on public.driver_locations(driver_code);
create index if not exists idx_driver_locations_updated_at on public.driver_locations(updated_at desc);
create index if not exists idx_passenger_scans_driver_id on public.passenger_scans(driver_id);
create index if not exists idx_reports_driver_id on public.reports(driver_id);
create index if not exists idx_reports_qr_id on public.reports(qr_id);
create unique index if not exists uq_violations_dedupe_key
on public.violations(dedupe_key)
where dedupe_key is not null;
create index if not exists idx_trip_route_points_trip on public.trip_route_points(trip_id);
create index if not exists idx_trip_routes_local_trip_recorded_at on public.trip_routes(local_trip_id, recorded_at);
create index if not exists idx_trip_routes_driver_recorded_at on public.trip_routes(driver_id, recorded_at desc);
create unique index if not exists uq_trip_routes_local_trip_point
on public.trip_routes(local_trip_id, driver_id, recorded_at, latitude, longitude);
create index if not exists idx_mobile_violations_driver_occurred_at_desc on public.mobile_violations(driver_id, occurred_at desc);
create index if not exists idx_mobile_violations_status on public.mobile_violations(status);
create index if not exists idx_mobile_violations_type on public.mobile_violations(type);
create index if not exists idx_violation_appeals_driver_submitted_at_desc on public.violation_appeals(driver_id, submitted_at desc);
create index if not exists idx_violation_appeals_violation on public.violation_appeals(violation_id);
create index if not exists idx_violation_appeals_admin_viewed_at on public.violation_appeals(admin_viewed_at desc nulls last);
create index if not exists idx_violation_appeals_admin_viewed_by on public.violation_appeals(admin_viewed_by_admin_id);
create unique index if not exists ux_active_appeal_per_violation
on public.violation_appeals(violation_id)
where status in (
  public.appeal_status_from_text('SUBMITTED'),
  public.appeal_status_from_text('UNDER_REVIEW')
);
create index if not exists idx_violation_proofs_driver_uploaded_at_desc on public.violation_proofs(driver_id, uploaded_at desc);
create index if not exists idx_violation_proofs_violation on public.violation_proofs(violation_id);
create unique index if not exists uq_qr_codes_active_per_driver
on public.qr_codes(driver_id)
where status = 'active';

alter table public.driver_locations enable row level security;
alter table public.trips enable row level security;
alter table public.trip_points enable row level security;
alter table public.trip_route_points enable row level security;
alter table public.trip_routes enable row level security;
alter table public.mobile_violations enable row level security;
alter table public.violation_appeals enable row level security;
alter table public.violation_proofs enable row level security;
alter table public.violations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'driver_locations'
      and policyname = 'authenticated_can_read_driver_locations'
  ) then
    create policy authenticated_can_read_driver_locations
    on public.driver_locations for select to anon, authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'driver_locations'
      and policyname = 'authenticated_can_insert_driver_locations'
  ) then
    create policy authenticated_can_insert_driver_locations
    on public.driver_locations for insert to anon, authenticated with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'driver_locations'
      and policyname = 'authenticated_can_update_driver_locations'
  ) then
    create policy authenticated_can_update_driver_locations
    on public.driver_locations for update to anon, authenticated using (true) with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trips'
      and policyname = 'authenticated_can_read_trips'
  ) then
    create policy authenticated_can_read_trips
    on public.trips for select to anon, authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trip_points'
      and policyname = 'authenticated_can_read_trip_points'
  ) then
    create policy authenticated_can_read_trip_points
    on public.trip_points for select to anon, authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trip_points'
      and policyname = 'authenticated_can_insert_trip_points'
  ) then
    create policy authenticated_can_insert_trip_points
    on public.trip_points for insert to anon, authenticated with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trip_routes'
      and policyname = 'authenticated_can_read_trip_routes'
  ) then
    create policy authenticated_can_read_trip_routes
    on public.trip_routes for select to anon, authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trip_route_points'
      and policyname = 'authenticated_can_read_trip_route_points'
  ) then
    create policy authenticated_can_read_trip_route_points
    on public.trip_route_points for select to anon, authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trip_routes'
      and policyname = 'authenticated_can_insert_trip_routes'
  ) then
    create policy authenticated_can_insert_trip_routes
    on public.trip_routes for insert to anon, authenticated with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trip_routes'
      and policyname = 'authenticated_can_update_trip_routes'
  ) then
    create policy authenticated_can_update_trip_routes
    on public.trip_routes for update to anon, authenticated using (true) with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trip_routes'
      and policyname = 'authenticated_can_delete_trip_routes'
  ) then
    create policy authenticated_can_delete_trip_routes
    on public.trip_routes for delete to anon, authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mobile_violations'
      and policyname = 'authenticated_can_read_mobile_violations'
  ) then
    create policy authenticated_can_read_mobile_violations
    on public.mobile_violations for select to anon, authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mobile_violations'
      and policyname = 'authenticated_can_insert_mobile_violations'
  ) then
    create policy authenticated_can_insert_mobile_violations
    on public.mobile_violations for insert to anon, authenticated with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'violation_appeals'
      and policyname = 'authenticated_can_read_violation_appeals'
  ) then
    create policy authenticated_can_read_violation_appeals
    on public.violation_appeals for select to anon, authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'violation_appeals'
      and policyname = 'authenticated_can_insert_violation_appeals'
  ) then
    create policy authenticated_can_insert_violation_appeals
    on public.violation_appeals for insert to anon, authenticated with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'violation_proofs'
      and policyname = 'authenticated_can_read_violation_proofs'
  ) then
    create policy authenticated_can_read_violation_proofs
    on public.violation_proofs for select to anon, authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'violation_proofs'
      and policyname = 'authenticated_can_insert_violation_proofs'
  ) then
    create policy authenticated_can_insert_violation_proofs
    on public.violation_proofs for insert to anon, authenticated with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'violations'
      and policyname = 'authenticated_can_read_violations'
  ) then
    create policy authenticated_can_read_violations
    on public.violations for select to authenticated using (true);
  end if;
end $$;

do $$
begin
  begin
    alter publication supabase_realtime add table public.driver_locations;
  exception when duplicate_object or undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.trips;
  exception when duplicate_object or undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.trip_route_points;
  exception when duplicate_object or undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.trip_routes;
  exception when duplicate_object or undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.mobile_violations;
  exception when duplicate_object or undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.violation_appeals;
  exception when duplicate_object or undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.violation_proofs;
  exception when duplicate_object or undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.violations;
  exception when duplicate_object or undefined_object then null;
  end;
end $$;

do $$
begin
  insert into storage.buckets (id, name, public)
  values ('driver-avatars', 'driver-avatars', true)
  on conflict (id) do nothing;

  insert into storage.buckets (id, name, public)
  values ('violation-proofs', 'violation-proofs', true)
  on conflict (id) do nothing;
exception
  when undefined_table then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'public_can_read_driver_avatars'
  ) then
    create policy public_can_read_driver_avatars
    on storage.objects for select to public using (bucket_id = 'driver-avatars');
  end if;
exception
  when undefined_table then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'public_can_upload_driver_avatars'
  ) then
    create policy public_can_upload_driver_avatars
    on storage.objects for insert to anon, authenticated
    with check (bucket_id = 'driver-avatars');
  end if;
exception
  when undefined_table then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'public_can_update_driver_avatars'
  ) then
    create policy public_can_update_driver_avatars
    on storage.objects for update to anon, authenticated
    using (bucket_id = 'driver-avatars')
    with check (bucket_id = 'driver-avatars');
  end if;
exception
  when undefined_table then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'public_can_read_violation_proofs'
  ) then
    create policy public_can_read_violation_proofs
    on storage.objects for select to public using (bucket_id = 'violation-proofs');
  end if;
exception
  when undefined_table then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'public_can_upload_violation_proofs'
  ) then
    create policy public_can_upload_violation_proofs
    on storage.objects for insert to anon, authenticated
    with check (bucket_id = 'violation-proofs');
  end if;
exception
  when undefined_table then null;
end $$;

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception
  when others then null;
end $$;

create extension if not exists pgcrypto;

do $$
begin
  create type admin_role as enum (
    'superadmin',
    'barangay_admin',
    'toda_admin'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type entity_status as enum (
    'active',
    'inactive',
    'suspended'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type qr_status as enum (
    'active',
    'inactive',
    'revoked',
    'expired'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type trip_status as enum (
    'scheduled',
    'ongoing',
    'completed',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type report_status as enum (
    'submitted',
    'under_review',
    'verified',
    'resolved',
    'dismissed'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type violation_status as enum (
    'open',
    'under_review',
    'resolved',
    'dismissed'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type violation_source as enum (
    'system',
    'passenger_report',
    'admin'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type media_type as enum (
    'image',
    'video',
    'audio',
    'document'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type mobile_violation_type as enum (
    'GEOFENCE_BOUNDARY',
    'ROUTE_DEVIATION',
    'UNAUTHORIZED_STOP'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type mobile_violation_status as enum (
    'OPEN',
    'UNDER_REVIEW',
    'RESOLVED'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type mobile_violation_priority as enum (
    'HIGH',
    'MEDIUM',
    'LOW'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type appeal_status as enum (
    'SUBMITTED',
    'UNDER_REVIEW',
    'APPROVED',
    'DENIED',
    'WITHDRAWN'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type emergency_alert_status as enum (
    'created',
    'pending_admin',
    'acknowledged',
    'responding',
    'resolved'
  );
exception when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.mobile_violation_status_from_text(p_label text)
returns mobile_violation_status
language plpgsql
immutable
as $$
declare
  v_status mobile_violation_status;
begin
  select enum_value
  into v_status
  from unnest(enum_range(null::mobile_violation_status)) as enum_value
  where lower(enum_value::text) = lower(trim(p_label))
  limit 1;

  if v_status is null then
    raise exception 'Invalid mobile_violation_status value: %', p_label;
  end if;

  return v_status;
end;
$$;

create or replace function public.mobile_violation_priority_from_text(p_label text)
returns mobile_violation_priority
language plpgsql
immutable
as $$
declare
  v_priority mobile_violation_priority;
begin
  select enum_value
  into v_priority
  from unnest(enum_range(null::mobile_violation_priority)) as enum_value
  where lower(enum_value::text) = lower(trim(p_label))
  limit 1;

  if v_priority is null then
    raise exception 'Invalid mobile_violation_priority value: %', p_label;
  end if;

  return v_priority;
end;
$$;

create or replace function public.appeal_status_from_text(p_label text)
returns appeal_status
language plpgsql
immutable
as $$
declare
  v_status appeal_status;
begin
  select enum_value
  into v_status
  from unnest(enum_range(null::appeal_status)) as enum_value
  where lower(enum_value::text) = lower(trim(p_label))
  limit 1;

  if v_status is null then
    raise exception 'Invalid appeal_status value: %', p_label;
  end if;

  return v_status;
end;
$$;

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

create table if not exists public.barangays (
  barangay_id bigint generated always as identity primary key,
  barangay_name text not null,
  district text,
  city text not null,
  status entity_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (barangay_name, city)
);

create table if not exists public.todas (
  toda_id bigint generated always as identity primary key,
  barangay_id bigint not null references public.barangays(barangay_id) on delete restrict,
  toda_name text not null,
  status entity_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (barangay_id, toda_name)
);

create table if not exists public.admin_accounts (
  admin_id bigint generated always as identity primary key,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  admin_role admin_role not null,
  barangay_id bigint references public.barangays(barangay_id) on delete restrict,
  toda_id bigint references public.todas(toda_id) on delete restrict,
  status entity_status not null default 'active',
  created_at timestamptz not null default now(),
  constraint admin_scope_check check (
    (admin_role = 'superadmin' and barangay_id is null and toda_id is null)
    or
    (admin_role = 'barangay_admin' and barangay_id is not null and toda_id is null)
    or
    (admin_role = 'toda_admin' and toda_id is not null and barangay_id is null)
  )
);

create table if not exists public.drivers (
  driver_id bigint generated always as identity primary key,
  driver_code text generated always as (
    'D-' || lpad(driver_id::text, 3, '0')
  ) stored unique,
  toda_id bigint not null references public.todas(toda_id) on delete restrict,
  tricycle_id bigint,
  qr_id bigint,
  first_name text not null,
  last_name text not null,
  contact_no text,
  avatar_url text,
  password_hash text,
  status entity_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.drivers add column if not exists tricycle_id bigint;
alter table public.drivers add column if not exists qr_id bigint;
alter table public.drivers add column if not exists contact_no text;
alter table public.drivers add column if not exists avatar_url text;
alter table public.drivers add column if not exists password_hash text;
alter table public.drivers add column if not exists updated_at timestamptz not null default now();
alter table public.drivers add column if not exists deleted_at timestamptz;

create table if not exists public.driver_password_reset_requests (
  request_id bigint generated always as identity primary key,
  driver_id bigint not null references public.drivers(driver_id) on delete cascade,
  driver_code text not null,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by bigint references public.admin_accounts(admin_id) on delete set null,
  temporary_password_hash text,
  temporary_password text,
  temporary_password_used_at timestamptz,
  expires_at timestamptz,
  device_push_token text,
  device_platform text,
  push_sent_at timestamptz,
  push_error text,
  resolved_at timestamptz,
  constraint driver_password_reset_requests_status_check
    check (status in ('pending', 'approved', 'denied', 'completed', 'expired'))
);

alter table public.driver_password_reset_requests add column if not exists approved_at timestamptz;
alter table public.driver_password_reset_requests add column if not exists approved_by bigint references public.admin_accounts(admin_id) on delete set null;
alter table public.driver_password_reset_requests add column if not exists temporary_password_hash text;
alter table public.driver_password_reset_requests add column if not exists temporary_password text;
alter table public.driver_password_reset_requests add column if not exists temporary_password_used_at timestamptz;
alter table public.driver_password_reset_requests add column if not exists expires_at timestamptz;
alter table public.driver_password_reset_requests add column if not exists device_push_token text;
alter table public.driver_password_reset_requests add column if not exists device_platform text;
alter table public.driver_password_reset_requests add column if not exists push_sent_at timestamptz;
alter table public.driver_password_reset_requests add column if not exists push_error text;
alter table public.driver_password_reset_requests add column if not exists resolved_at timestamptz;

create table if not exists public.admin_audit_logs (
  audit_id bigint generated always as identity primary key,
  admin_id bigint references public.admin_accounts(admin_id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tricycles (
  tricycle_id bigint generated always as identity primary key,
  toda_id bigint not null references public.todas(toda_id) on delete restrict,
  plate_no text not null unique,
  reg_no text unique,
  permit_expiration_date date,
  status entity_status not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.routes (
  route_id bigint generated always as identity primary key,
  toda_id bigint not null references public.todas(toda_id) on delete restrict,
  origin text not null,
  destination text not null,
  geofence_geojson jsonb,
  default_fare_amount numeric(10,2),
  status entity_status not null default 'active',
  created_at timestamptz not null default now(),
  constraint route_default_fare_check check (
    default_fare_amount is null or default_fare_amount >= 0
  ),
  unique (toda_id, origin, destination)
);

create table if not exists public.qr_codes (
  qr_id bigint generated always as identity primary key,
  driver_id bigint,
  tricycle_id bigint references public.tricycles(tricycle_id) on delete set null,
  qr_token text not null unique,
  status qr_status not null default 'active',
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.report_types (
  report_type_id bigint generated always as identity primary key,
  code text not null unique,
  label text not null
);

create table if not exists public.violation_types (
  violation_type_id bigint generated always as identity primary key,
  code text not null unique,
  label text not null
);

create table if not exists public.trips (
  trip_id bigint generated always as identity primary key,
  driver_id bigint not null references public.drivers(driver_id) on delete restrict,
  tricycle_id bigint not null references public.tricycles(tricycle_id) on delete restrict,
  route_id bigint not null references public.routes(route_id) on delete restrict,
  trip_start timestamptz not null,
  trip_end timestamptz,
  duration_minutes integer,
  fare_amount numeric(10,2),
  trip_status trip_status not null default 'scheduled',
  start_location_raw jsonb,
  start_location_matched jsonb,
  end_location_raw jsonb,
  end_location_matched jsonb,
  start_display_name text,
  end_display_name text,
  start_coordinate jsonb,
  end_coordinate jsonb,
  dashed_start_connector jsonb,
  dashed_end_connector jsonb,
  route_trace_geojson jsonb,
  trip_metrics jsonb,
  gps_quality_summary jsonb,
  raw_gps_point_count integer not null default 0,
  matched_point_count integer not null default 0,
  offline_segments_count integer not null default 0,
  sync_status text not null default 'SYNC_PENDING',
  created_at timestamptz not null default now(),
  constraint trip_time_check check (
    trip_end is null or trip_end >= trip_start
  ),
  constraint trip_duration_check check (
    duration_minutes is null or duration_minutes >= 0
  ),
  constraint trip_fare_check check (
    fare_amount is null or fare_amount >= 0
  )
);

create table if not exists public.trip_points (
  point_id bigint generated always as identity primary key,
  trip_id bigint references public.trips(trip_id) on delete cascade,
  driver_id bigint not null references public.drivers(driver_id) on delete restrict,
  recorded_at timestamptz not null,
  lng double precision not null,
  lat double precision not null,
  speed double precision,
  heading double precision,
  accuracy double precision,
  altitude double precision,
  provider text,
  dedup_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.driver_locations (
  driver_id bigint primary key references public.drivers(driver_id) on delete cascade,
  driver_code text not null,
  trip_id bigint references public.trips(trip_id) on delete set null,
  latitude double precision not null,
  longitude double precision not null,
  speed double precision,
  heading double precision,
  accuracy double precision,
  recorded_at timestamptz not null,
  is_online boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_paths (
  trip_path_id bigint generated always as identity primary key,
  trip_id bigint not null unique references public.trips(trip_id) on delete cascade,
  point_count integer not null default 0,
  path_geojson jsonb not null,
  started_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.passenger_scans (
  scan_id bigint generated always as identity primary key,
  trip_id bigint references public.trips(trip_id) on delete set null,
  driver_id bigint not null references public.drivers(driver_id) on delete cascade,
  qr_id bigint not null references public.qr_codes(qr_id) on delete restrict,
  scanned_at timestamptz not null default now(),
  device_info jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  report_id bigint generated always as identity primary key,
  scan_id bigint not null references public.passenger_scans(scan_id) on delete cascade,
  trip_id bigint references public.trips(trip_id) on delete set null,
  driver_id bigint not null references public.drivers(driver_id) on delete cascade,
  qr_id bigint not null references public.qr_codes(qr_id) on delete restrict,
  report_type_id bigint not null references public.report_types(report_type_id) on delete restrict,
  source text not null default 'qr_web_form',
  passenger_name text,
  passenger_contact text,
  description text not null,
  reported_at timestamptz not null default now(),
  status report_status not null default 'submitted',
  created_at timestamptz not null default now()
);

create table if not exists public.report_media (
  media_id bigint generated always as identity primary key,
  report_id bigint not null references public.reports(report_id) on delete cascade,
  media_type media_type not null,
  file_url text not null,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.violations (
  violation_id bigint generated always as identity primary key,
  violation_type_id bigint not null references public.violation_types(violation_type_id) on delete restrict,
  trip_id bigint references public.trips(trip_id) on delete set null,
  report_id bigint references public.reports(report_id) on delete set null,
  driver_id bigint references public.drivers(driver_id) on delete set null,
  tricycle_id bigint references public.tricycles(tricycle_id) on delete set null,
  description text,
  latitude double precision,
  longitude double precision,
  location_label text,
  dedupe_key text,
  detected_at timestamptz not null default now(),
  source violation_source not null default 'system',
  status violation_status not null default 'open',
  created_at timestamptz not null default now(),
  constraint violation_reference_check check (
    trip_id is not null
    or report_id is not null
    or driver_id is not null
    or tricycle_id is not null
  )
);

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
  type mobile_violation_type not null,
  status mobile_violation_status not null default 'OPEN',
  priority mobile_violation_priority not null default 'MEDIUM',
  occurred_at timestamptz not null default now(),
  title text,
  latitude double precision,
  longitude double precision,
  location_label text,
  details text,
  dedupe_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.violation_appeals (
  id uuid primary key default gen_random_uuid(),
  violation_id uuid not null references public.mobile_violations(id) on delete cascade,
  driver_id bigint not null references public.drivers(driver_id) on delete cascade,
  reason text not null,
  details text,
  status appeal_status not null default 'SUBMITTED',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  decision_notes text,
  admin_viewed_at timestamptz,
  admin_viewed_by_admin_id bigint references public.admin_accounts(admin_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.emergency_alerts (
  emergency_id bigint generated always as identity primary key,
  passenger_tracking_key uuid not null unique,
  qr_id bigint not null references public.qr_codes(qr_id) on delete restrict,
  qr_token text not null,
  driver_id bigint not null references public.drivers(driver_id) on delete cascade,
  tricycle_id bigint references public.tricycles(tricycle_id) on delete set null,
  trip_id bigint references public.trips(trip_id) on delete set null,
  route_id bigint references public.routes(route_id) on delete set null,
  toda_id bigint not null references public.todas(toda_id) on delete restrict,
  barangay_id bigint not null references public.barangays(barangay_id) on delete restrict,
  source text not null default 'qr_emergency_button',
  alert_type text not null default 'emergency',
  status emergency_alert_status not null default 'pending_admin',
  latitude double precision,
  longitude double precision,
  location_label text,
  device_info jsonb,
  acknowledged_by_admin_id bigint references public.admin_accounts(admin_id) on delete set null,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_notification_reads (
  admin_id bigint not null references public.admin_accounts(admin_id) on delete cascade,
  notification_key text not null,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (admin_id, notification_key)
);

drop function if exists public.request_driver_password_reset(text);
drop function if exists public.request_driver_password_reset(text, text, text);
create or replace function public.request_driver_password_reset(
  p_driver_code text,
  p_device_push_token text default null,
  p_device_platform text default null
)
returns table (
  request_id bigint,
  driver_id bigint,
  driver_code text,
  status text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_driver_id bigint;
  target_driver_code text;
  existing_request_id bigint;
  existing_request_driver_id bigint;
  existing_request_driver_code text;
  existing_request_status text;
begin
  select d.driver_id, coalesce(d.driver_code, d.driver_id::text) as driver_code
    into target_driver_id, target_driver_code
  from public.drivers d
  where d.status = 'active'
    and upper(coalesce(d.driver_code, d.driver_id::text)) = upper(p_driver_code)
  limit 1;

  if target_driver_id is null then
    return;
  end if;

  select r.request_id, r.driver_id, r.driver_code, r.status
    into existing_request_id, existing_request_driver_id, existing_request_driver_code, existing_request_status
  from public.driver_password_reset_requests r
  where r.driver_id = target_driver_id
    and r.status in ('pending', 'approved')
    and (r.expires_at is null or r.expires_at >= now())
  order by r.requested_at desc
  limit 1;

  if existing_request_id is not null then
    update public.driver_password_reset_requests
    set
      device_push_token = coalesce(nullif(trim(p_device_push_token), ''), device_push_token),
      device_platform = coalesce(nullif(trim(p_device_platform), ''), device_platform)
    where request_id = existing_request_id;

    request_id := existing_request_id;
    driver_id := existing_request_driver_id;
    driver_code := existing_request_driver_code;
    status := existing_request_status;
    return next;
    return;
  end if;

  insert into public.driver_password_reset_requests (
    driver_id,
    driver_code,
    device_push_token,
    device_platform
  )
  values (
    target_driver_id,
    target_driver_code,
    nullif(trim(p_device_push_token), ''),
    nullif(trim(p_device_platform), '')
  )
  returning
    driver_password_reset_requests.request_id,
    driver_password_reset_requests.driver_id,
    driver_password_reset_requests.driver_code,
    driver_password_reset_requests.status
  into request_id, driver_id, driver_code, status;

  return next;
end;
$$;

drop function if exists public.get_driver_password_reset_status(text);
create or replace function public.get_driver_password_reset_status(p_driver_code text)
returns table (
  request_id bigint,
  driver_id bigint,
  driver_code text,
  status text,
  temporary_password text,
  requested_at timestamptz,
  approved_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_driver_id bigint;
begin
  select d.driver_id
    into target_driver_id
  from public.drivers d
  where d.status = 'active'
    and upper(coalesce(d.driver_code, d.driver_id::text)) = upper(p_driver_code)
  limit 1;

  if target_driver_id is null then
    return;
  end if;

  update public.driver_password_reset_requests r
  set
    status = 'expired',
    temporary_password = null,
    temporary_password_hash = null,
    resolved_at = coalesce(r.resolved_at, now())
  where r.driver_id = target_driver_id
    and r.status = 'approved'
    and r.expires_at is not null
    and r.expires_at < now();

  return query
  select
    r.request_id,
    r.driver_id,
    r.driver_code,
    r.status,
    null::text as temporary_password,
    r.requested_at,
    r.approved_at,
    r.expires_at
  from public.driver_password_reset_requests r
  where r.driver_id = target_driver_id
    and r.status in ('pending', 'approved', 'denied', 'expired')
  order by r.requested_at desc
  limit 1;
end;
$$;

drop function if exists public.complete_driver_password_reset(text, text, text);
create or replace function public.complete_driver_password_reset(
  p_driver_code text,
  p_temporary_password text,
  p_new_password text
)
returns table (
  id bigint,
  full_name text,
  driver_id text,
  contact_number text,
  plate_number text,
  avatar_url text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_driver_id bigint;
  reset_request_id bigint;
begin
  if length(coalesce(p_new_password, '')) < 6 then
    raise exception 'Password must be at least 6 characters long.';
  end if;

  select d.driver_id
    into target_driver_id
  from public.drivers d
  where d.status = 'active'
    and upper(coalesce(d.driver_code, d.driver_id::text)) = upper(p_driver_code)
  limit 1;

  if target_driver_id is null then
    return;
  end if;

  select r.request_id
    into reset_request_id
  from public.driver_password_reset_requests r
  where r.driver_id = target_driver_id
    and r.status = 'approved'
    and r.temporary_password_hash is not null
    and r.temporary_password_used_at is null
    and (r.expires_at is null or r.expires_at >= now())
    and r.temporary_password_hash = crypt(p_temporary_password, r.temporary_password_hash)
  order by r.approved_at desc nulls last, r.requested_at desc
  limit 1;

  if reset_request_id is null then
    raise exception 'Invalid or expired temporary reset password.';
  end if;

  update public.drivers d
  set
    password_hash = crypt(p_new_password, gen_salt('bf')),
    updated_at = now()
  where d.driver_id = target_driver_id;

update public.driver_password_reset_requests r
  set
    status = 'completed',
    temporary_password = null,
    temporary_password_hash = null,
    temporary_password_used_at = now(),
    resolved_at = now()
  where r.request_id = reset_request_id;

  return query
  select
    d.driver_id as id,
    trim(concat_ws(' ', d.first_name, d.last_name)) as full_name,
    coalesce(d.driver_code, d.driver_id::text) as driver_id,
    coalesce(d.contact_no, '') as contact_number,
    coalesce(t.plate_no, '') as plate_number,
    d.avatar_url
  from public.drivers d
  left join public.tricycles t on t.tricycle_id = d.tricycle_id
  where d.driver_id = target_driver_id;
end;
$$;

drop function if exists public.verify_driver_temporary_password(text, text);
create or replace function public.verify_driver_temporary_password(
  p_driver_code text,
  p_temporary_password text
)
returns table (
  request_id bigint,
  driver_id bigint,
  driver_code text,
  status text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_driver_id bigint;
begin
  select d.driver_id
    into target_driver_id
  from public.drivers d
  where d.status = 'active'
    and upper(coalesce(d.driver_code, d.driver_id::text)) = upper(p_driver_code)
  limit 1;

  if target_driver_id is null then
    return;
  end if;

  select r.request_id, r.driver_id, r.driver_code, r.status
    into request_id, driver_id, driver_code, status
  from public.driver_password_reset_requests r
  where r.driver_id = target_driver_id
    and r.status = 'approved'
    and r.temporary_password_hash is not null
    and r.temporary_password_used_at is null
    and (r.expires_at is null or r.expires_at >= now())
    and r.temporary_password_hash = crypt(p_temporary_password, r.temporary_password_hash)
  order by r.approved_at desc nulls last, r.requested_at desc
  limit 1;

  if request_id is null then
    return;
  end if;

  return next;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'qr_codes_driver_id_fkey'
  ) then
    alter table public.qr_codes
      add constraint qr_codes_driver_id_fkey
      foreign key (driver_id)
      references public.drivers(driver_id)
      on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'drivers_tricycle_id_fkey'
  ) then
    alter table public.drivers
      add constraint drivers_tricycle_id_fkey
      foreign key (tricycle_id)
      references public.tricycles(tricycle_id)
      on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'drivers_qr_id_fkey'
  ) then
    alter table public.drivers
      add constraint drivers_qr_id_fkey
      foreign key (qr_id)
      references public.qr_codes(qr_id)
      on delete set null;
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

drop trigger if exists trg_trip_points_geofence_violation on public.trip_points;
create trigger trg_trip_points_geofence_violation
after insert on public.trip_points
for each row execute function public.create_geofence_violation_from_trip_point();

create index if not exists idx_todas_barangay_id on public.todas(barangay_id);

create index if not exists idx_admin_accounts_barangay_id on public.admin_accounts(barangay_id);
create index if not exists idx_admin_accounts_toda_id on public.admin_accounts(toda_id);
create index if not exists idx_admin_accounts_role on public.admin_accounts(admin_role);
create index if not exists idx_admin_audit_logs_admin_created_at
on public.admin_audit_logs(admin_id, created_at desc);

create index if not exists idx_drivers_toda_id on public.drivers(toda_id);
create index if not exists idx_drivers_tricycle_id on public.drivers(tricycle_id);
create index if not exists idx_drivers_qr_id on public.drivers(qr_id);
create index if not exists idx_driver_password_reset_requests_driver_requested_at_desc
on public.driver_password_reset_requests(driver_id, requested_at desc);
create index if not exists idx_driver_password_reset_requests_status_requested_at_desc
on public.driver_password_reset_requests(status, requested_at desc);
create unique index if not exists idx_driver_password_reset_requests_one_pending
on public.driver_password_reset_requests(driver_id)
where status = 'pending';

create index if not exists idx_tricycles_toda_id on public.tricycles(toda_id);
create index if not exists idx_tricycles_permit_expiration_date on public.tricycles(permit_expiration_date);

create index if not exists idx_routes_toda_id on public.routes(toda_id);

create index if not exists idx_qr_codes_driver_id on public.qr_codes(driver_id);
create index if not exists idx_qr_codes_tricycle_id on public.qr_codes(tricycle_id);
create unique index if not exists uq_qr_codes_active_per_driver
on public.qr_codes(driver_id)
where status = 'active';

create index if not exists idx_trips_driver_id on public.trips(driver_id);
create index if not exists idx_trips_tricycle_id on public.trips(tricycle_id);
create index if not exists idx_trips_route_id on public.trips(route_id);
create index if not exists idx_trips_status on public.trips(trip_status);
create index if not exists idx_trips_trip_start on public.trips(trip_start);

create index if not exists idx_trip_points_trip_id on public.trip_points(trip_id);
create index if not exists idx_trip_points_driver_id on public.trip_points(driver_id);
create index if not exists idx_trip_points_recorded_at on public.trip_points(recorded_at desc);
create index if not exists idx_driver_locations_trip_id on public.driver_locations(trip_id);
create index if not exists idx_driver_locations_recorded_at on public.driver_locations(recorded_at desc);
create index if not exists idx_driver_locations_driver_code on public.driver_locations(driver_code);
create index if not exists idx_driver_locations_updated_at on public.driver_locations(updated_at desc);
create index if not exists idx_trip_paths_updated_at on public.trip_paths(updated_at desc);

create index if not exists idx_passenger_scans_trip_id on public.passenger_scans(trip_id);
create index if not exists idx_passenger_scans_driver_id on public.passenger_scans(driver_id);
create index if not exists idx_passenger_scans_qr_id on public.passenger_scans(qr_id);
create index if not exists idx_passenger_scans_scanned_at on public.passenger_scans(scanned_at);

create index if not exists idx_reports_scan_id on public.reports(scan_id);
create index if not exists idx_reports_trip_id on public.reports(trip_id);
create index if not exists idx_reports_driver_id on public.reports(driver_id);
create index if not exists idx_reports_qr_id on public.reports(qr_id);
create index if not exists idx_reports_report_type_id on public.reports(report_type_id);
create index if not exists idx_reports_reported_at on public.reports(reported_at);
create index if not exists idx_reports_status on public.reports(status);

create index if not exists idx_report_media_report_id on public.report_media(report_id);

create index if not exists idx_violations_type_id on public.violations(violation_type_id);
create index if not exists idx_violations_trip_id on public.violations(trip_id);
create index if not exists idx_violations_report_id on public.violations(report_id);
create index if not exists idx_violations_driver_id on public.violations(driver_id);
create index if not exists idx_violations_tricycle_id on public.violations(tricycle_id);
create index if not exists idx_violations_status on public.violations(status);
create index if not exists idx_violations_detected_at on public.violations(detected_at);
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
create unique index if not exists uq_mobile_violations_dedupe_key
on public.mobile_violations(dedupe_key)
where dedupe_key is not null;
create index if not exists idx_violation_appeals_driver_submitted_at_desc on public.violation_appeals(driver_id, submitted_at desc);
create index if not exists idx_violation_appeals_violation on public.violation_appeals(violation_id);
create index if not exists idx_violation_appeals_admin_viewed_at
on public.violation_appeals(admin_viewed_at desc nulls last);
create index if not exists idx_violation_appeals_admin_viewed_by
on public.violation_appeals(admin_viewed_by_admin_id);
create unique index if not exists ux_active_appeal_per_violation
on public.violation_appeals(violation_id)
where status in ('SUBMITTED', 'UNDER_REVIEW');
create index if not exists idx_violation_proofs_driver_uploaded_at_desc on public.violation_proofs(driver_id, uploaded_at desc);
create index if not exists idx_violation_proofs_violation on public.violation_proofs(violation_id);

create index if not exists idx_emergency_alerts_status on public.emergency_alerts(status);
create index if not exists idx_emergency_alerts_created_at on public.emergency_alerts(created_at desc);
create index if not exists idx_emergency_alerts_driver_id on public.emergency_alerts(driver_id);
create index if not exists idx_emergency_alerts_trip_id on public.emergency_alerts(trip_id);
create index if not exists idx_emergency_alerts_toda_id on public.emergency_alerts(toda_id);
create index if not exists idx_emergency_alerts_barangay_id on public.emergency_alerts(barangay_id);
create index if not exists idx_admin_notification_reads_admin_read_at
on public.admin_notification_reads(admin_id, read_at desc);

insert into public.report_types (code, label) values
  ('harassment', 'Harassment'),
  ('reckless_driving', 'Reckless Driving'),
  ('fare_overpricing', 'Fare Overpricing'),
  ('other', 'Other')
on conflict (code) do nothing;

insert into public.violation_types (code, label) values
  ('geofence_deviation', 'Geofence Deviation'),
  ('permit_expiration', 'Permit Expiration'),
  ('reckless_driving', 'Reckless Driving'),
  ('fare_overpricing', 'Fare Overpricing'),
  ('other', 'Other')
on conflict (code) do nothing;

alter table public.driver_locations enable row level security;
alter table public.trips enable row level security;
alter table public.trip_points enable row level security;
alter table public.trip_route_points enable row level security;
alter table public.trip_routes enable row level security;
alter table public.mobile_violations enable row level security;
alter table public.driver_password_reset_requests enable row level security;
alter table public.violation_appeals enable row level security;
alter table public.violation_proofs enable row level security;
alter table public.violations enable row level security;
alter table public.admin_audit_logs enable row level security;

drop policy if exists authenticated_can_read_driver_locations on public.driver_locations;
create policy authenticated_can_read_driver_locations
on public.driver_locations
for select
to anon, authenticated
using (true);

drop policy if exists authenticated_can_insert_driver_locations on public.driver_locations;
create policy authenticated_can_insert_driver_locations
on public.driver_locations
for insert
to anon, authenticated
with check (true);

drop policy if exists authenticated_can_update_driver_locations on public.driver_locations;
create policy authenticated_can_update_driver_locations
on public.driver_locations
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists authenticated_can_read_trips on public.trips;
create policy authenticated_can_read_trips
on public.trips
for select
to anon, authenticated
using (true);

drop policy if exists authenticated_can_read_trip_points on public.trip_points;
create policy authenticated_can_read_trip_points
on public.trip_points
for select
to anon, authenticated
using (true);

drop policy if exists authenticated_can_insert_trip_points on public.trip_points;
create policy authenticated_can_insert_trip_points
on public.trip_points
for insert
to anon, authenticated
with check (true);

drop policy if exists authenticated_can_read_trip_route_points on public.trip_route_points;
create policy authenticated_can_read_trip_route_points
on public.trip_route_points
for select
to anon, authenticated
using (true);

drop policy if exists authenticated_can_read_trip_routes on public.trip_routes;
create policy authenticated_can_read_trip_routes
on public.trip_routes
for select
to anon, authenticated
using (true);

drop policy if exists authenticated_can_insert_trip_routes on public.trip_routes;
create policy authenticated_can_insert_trip_routes
on public.trip_routes
for insert
to anon, authenticated
with check (true);

drop policy if exists authenticated_can_update_trip_routes on public.trip_routes;
create policy authenticated_can_update_trip_routes
on public.trip_routes
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists authenticated_can_delete_trip_routes on public.trip_routes;
create policy authenticated_can_delete_trip_routes
on public.trip_routes
for delete
to anon, authenticated
using (true);

drop policy if exists authenticated_can_read_mobile_violations on public.mobile_violations;
create policy authenticated_can_read_mobile_violations
on public.mobile_violations
for select
to anon, authenticated
using (true);

drop policy if exists authenticated_can_insert_mobile_violations on public.mobile_violations;
create policy authenticated_can_insert_mobile_violations
on public.mobile_violations
for insert
to anon, authenticated
with check (true);

drop policy if exists authenticated_can_update_mobile_violations on public.mobile_violations;
create policy authenticated_can_update_mobile_violations
on public.mobile_violations
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists authenticated_can_read_driver_password_reset_requests on public.driver_password_reset_requests;
create policy authenticated_can_read_driver_password_reset_requests
on public.driver_password_reset_requests
for select
to anon, authenticated
using (true);

drop policy if exists authenticated_can_read_violation_appeals on public.violation_appeals;
create policy authenticated_can_read_violation_appeals
on public.violation_appeals
for select
to anon, authenticated
using (true);

drop policy if exists authenticated_can_insert_violation_appeals on public.violation_appeals;
create policy authenticated_can_insert_violation_appeals
on public.violation_appeals
for insert
to anon, authenticated
with check (true);

drop policy if exists authenticated_can_read_violation_proofs on public.violation_proofs;
create policy authenticated_can_read_violation_proofs
on public.violation_proofs
for select
to anon, authenticated
using (true);

drop policy if exists authenticated_can_insert_violation_proofs on public.violation_proofs;
create policy authenticated_can_insert_violation_proofs
on public.violation_proofs
for insert
to anon, authenticated
with check (true);

drop policy if exists authenticated_can_read_violations on public.violations;
create policy authenticated_can_read_violations
on public.violations
for select
to authenticated
using (true);

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
    alter publication supabase_realtime add table public.driver_password_reset_requests;
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
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public_can_read_driver_avatars'
  ) then
    create policy public_can_read_driver_avatars
    on storage.objects
    for select
    to public
    using (bucket_id = 'driver-avatars');
  end if;
exception
  when undefined_table then null;
end $$;

grant execute on function public.request_driver_password_reset(text, text, text) to anon, authenticated;
grant execute on function public.get_driver_password_reset_status(text) to anon, authenticated;
grant execute on function public.complete_driver_password_reset(text, text, text) to anon, authenticated;
grant execute on function public.verify_driver_temporary_password(text, text) to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public_can_upload_driver_avatars'
  ) then
    create policy public_can_upload_driver_avatars
    on storage.objects
    for insert
    to anon, authenticated
    with check (bucket_id = 'driver-avatars');
  end if;
exception
  when undefined_table then null;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public_can_update_driver_avatars'
  ) then
    create policy public_can_update_driver_avatars
    on storage.objects
    for update
    to anon, authenticated
    using (bucket_id = 'driver-avatars')
    with check (bucket_id = 'driver-avatars');
  end if;
exception
  when undefined_table then null;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public_can_read_violation_proofs'
  ) then
    create policy public_can_read_violation_proofs
    on storage.objects
    for select
    to public
    using (bucket_id = 'violation-proofs');
  end if;
exception
  when undefined_table then null;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public_can_upload_violation_proofs'
  ) then
    create policy public_can_upload_violation_proofs
    on storage.objects
    for insert
    to anon, authenticated
    with check (bucket_id = 'violation-proofs');
  end if;
exception
  when undefined_table then null;
end $$;

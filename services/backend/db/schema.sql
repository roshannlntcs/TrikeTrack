create type admin_role as enum (
  'superadmin',
  'barangay_admin',
  'toda_admin'
);

create type entity_status as enum (
  'active',
  'inactive',
  'suspended'
);

create type qr_status as enum (
  'active',
  'inactive',
  'revoked',
  'expired'
);

create type trip_status as enum (
  'scheduled',
  'ongoing',
  'completed',
  'cancelled'
);

create type report_status as enum (
  'submitted',
  'under_review',
  'verified',
  'resolved',
  'dismissed'
);

create type violation_status as enum (
  'open',
  'under_review',
  'resolved',
  'dismissed'
);

create type violation_source as enum (
  'system',
  'passenger_report',
  'admin'
);

create type media_type as enum (
  'image',
  'video',
  'audio',
  'document'
);

create table public.barangays (
  barangay_id bigint generated always as identity primary key,
  barangay_name text not null,
  district text,
  city text not null,
  status entity_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (barangay_name, city)
);

create table public.todas (
  toda_id bigint generated always as identity primary key,
  barangay_id bigint not null references public.barangays(barangay_id) on delete restrict,
  toda_name text not null,
  status entity_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (barangay_id, toda_name)
);

create table public.admin_accounts (
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

create table public.drivers (
  driver_id bigint generated always as identity primary key,
  driver_code text generated always as (
    'D-' || lpad(driver_id::text, 3, '0')
  ) stored unique,
  toda_id bigint not null references public.todas(toda_id) on delete restrict,
  tricycle_id bigint references public.tricycles(tricycle_id) on delete set null,
  qr_id bigint references public.qr_codes(qr_id) on delete set null,
  first_name text not null,
  last_name text not null,
  contact_no text,
  avatar_url text,
  password_hash text,
  status entity_status not null default 'active',
  created_at timestamptz not null default now()
);

create table public.tricycles (
  tricycle_id bigint generated always as identity primary key,
  toda_id bigint not null references public.todas(toda_id) on delete restrict,
  plate_no text not null unique,
  reg_no text unique,
  permit_expiration_date date,
  status entity_status not null default 'active',
  created_at timestamptz not null default now()
);

create table public.routes (
  route_id bigint generated always as identity primary key,
  toda_id bigint not null references public.todas(toda_id) on delete restrict,
  origin text not null,
  destination text not null,a
  geofence_geojson jsonb,
  status entity_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (toda_id, origin, destination)
);

create table public.qr_codes (
  qr_id bigint generated always as identity primary key,
  tricycle_id bigint not null references public.tricycles(tricycle_id) on delete cascade,
  qr_token text not null unique,
  status qr_status not null default 'active',
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.report_types (
  report_type_id bigint generated always as identity primary key,
  code text not null unique,
  label text not null
);

create table public.violation_types (
  violation_type_id bigint generated always as identity primary key,
  code text not null unique,
  label text not null
);

create table public.trips (
  trip_id bigint generated always as identity primary key,
  driver_id bigint not null references public.drivers(driver_id) on delete restrict,
  tricycle_id bigint not null references public.tricycles(tricycle_id) on delete restrict,
  route_id bigint not null references public.routes(route_id) on delete restrict,
  trip_start timestamptz not null,
  trip_end timestamptz,
  duration_minutes integer,
  fare_amount numeric(10,2),
  trip_status trip_status not null default 'scheduled',
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

create table public.trip_points (
  point_id bigint generated always as identity primary key,
  trip_id bigint references public.trips(trip_id) on delete cascade,
  driver_id bigint not null references public.drivers(driver_id) on delete restrict,
  recorded_at timestamptz not null,
  lng double precision not null,
  lat double precision not null,
  speed double precision,
  heading double precision,
  accuracy double precision,
  dedup_key text not null unique,
  created_at timestamptz not null default now()
);

create table public.passenger_scans (
  scan_id bigint generated always as identity primary key,
  trip_id bigint not null references public.trips(trip_id) on delete cascade,
  qr_id bigint not null references public.qr_codes(qr_id) on delete restrict,
  scanned_at timestamptz not null default now(),
  device_info jsonb,
  created_at timestamptz not null default now()
);

create table public.reports (
  report_id bigint generated always as identity primary key,
  scan_id bigint not null references public.passenger_scans(scan_id) on delete cascade,
  trip_id bigint not null references public.trips(trip_id) on delete cascade,
  report_type_id bigint not null references public.report_types(report_type_id) on delete restrict,
  description text not null,
  reported_at timestamptz not null default now(),
  status report_status not null default 'submitted',
  created_at timestamptz not null default now()
);

create table public.report_media (
  media_id bigint generated always as identity primary key,
  report_id bigint not null references public.reports(report_id) on delete cascade,
  media_type media_type not null,
  file_url text not null,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.violations (
  violation_id bigint generated always as identity primary key,
  violation_type_id bigint not null references public.violation_types(violation_type_id) on delete restrict,
  trip_id bigint references public.trips(trip_id) on delete set null,
  report_id bigint references public.reports(report_id) on delete set null,
  driver_id bigint references public.drivers(driver_id) on delete set null,
  tricycle_id bigint references public.tricycles(tricycle_id) on delete set null,
  description text,
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

create index idx_todas_barangay_id on public.todas(barangay_id);

create index idx_admin_accounts_barangay_id on public.admin_accounts(barangay_id);
create index idx_admin_accounts_toda_id on public.admin_accounts(toda_id);
create index idx_admin_accounts_role on public.admin_accounts(admin_role);

create index idx_drivers_toda_id on public.drivers(toda_id);
create index idx_drivers_tricycle_id on public.drivers(tricycle_id);
create index idx_drivers_qr_id on public.drivers(qr_id);

create index idx_tricycles_toda_id on public.tricycles(toda_id);
create index idx_tricycles_permit_expiration_date on public.tricycles(permit_expiration_date);

create index idx_routes_toda_id on public.routes(toda_id);

create index idx_qr_codes_tricycle_id on public.qr_codes(tricycle_id);
create unique index uq_qr_codes_active_per_tricycle
on public.qr_codes(tricycle_id)
where status = 'active';

create index idx_trips_driver_id on public.trips(driver_id);
create index idx_trips_tricycle_id on public.trips(tricycle_id);
create index idx_trips_route_id on public.trips(route_id);
create index idx_trips_status on public.trips(trip_status);
create index idx_trips_trip_start on public.trips(trip_start);

create index idx_trip_points_trip_id on public.trip_points(trip_id);
create index idx_trip_points_driver_id on public.trip_points(driver_id);
create index idx_trip_points_recorded_at on public.trip_points(recorded_at desc);

create index idx_passenger_scans_trip_id on public.passenger_scans(trip_id);
create index idx_passenger_scans_qr_id on public.passenger_scans(qr_id);
create index idx_passenger_scans_scanned_at on public.passenger_scans(scanned_at);

create index idx_reports_scan_id on public.reports(scan_id);
create index idx_reports_trip_id on public.reports(trip_id);
create index idx_reports_report_type_id on public.reports(report_type_id);
create index idx_reports_reported_at on public.reports(reported_at);
create index idx_reports_status on public.reports(status);

create index idx_report_media_report_id on public.report_media(report_id);

create index idx_violations_type_id on public.violations(violation_type_id);
create index idx_violations_trip_id on public.violations(trip_id);
create index idx_violations_report_id on public.violations(report_id);
create index idx_violations_driver_id on public.violations(driver_id);
create index idx_violations_tricycle_id on public.violations(tricycle_id);
create index idx_violations_status on public.violations(status);
create index idx_violations_detected_at on public.violations(detected_at);

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

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'emergency_alert_status') THEN
        CREATE TYPE emergency_alert_status AS ENUM (
            'created',
            'pending_admin',
            'acknowledged',
            'responding',
            'resolved'
        );
    END IF;
END $$;

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
  passenger_latitude double precision,
  passenger_longitude double precision,
  location_accuracy double precision,
  location_captured_at timestamptz,
  passenger_location_name text,
  location_label text,
  device_info jsonb,
  acknowledged_by_admin_id bigint references public.admin_accounts(admin_id) on delete set null,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.emergency_alerts
  add column if not exists passenger_latitude double precision,
  add column if not exists passenger_longitude double precision,
  add column if not exists location_accuracy double precision,
  add column if not exists location_captured_at timestamptz,
  add column if not exists passenger_location_name text;

update public.emergency_alerts
set passenger_location_name = coalesce(passenger_location_name, location_label)
where passenger_location_name is null
  and location_label is not null
  and location_label !~ '^-?[0-9]+(\.[0-9]+)?,\s*-?[0-9]+(\.[0-9]+)?$';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'emergency_alerts'
      and column_name = 'latitude'
  ) then
    update public.emergency_alerts
    set passenger_latitude = coalesce(passenger_latitude, latitude)
    where passenger_latitude is null
      and latitude is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'emergency_alerts'
      and column_name = 'longitude'
  ) then
    update public.emergency_alerts
    set passenger_longitude = coalesce(passenger_longitude, longitude)
    where passenger_longitude is null
      and longitude is not null;
  end if;
end $$;

create index if not exists idx_emergency_alerts_status on public.emergency_alerts(status);
create index if not exists idx_emergency_alerts_created_at on public.emergency_alerts(created_at desc);
create index if not exists idx_emergency_alerts_driver_id on public.emergency_alerts(driver_id);
create index if not exists idx_emergency_alerts_trip_id on public.emergency_alerts(trip_id);
create index if not exists idx_emergency_alerts_toda_id on public.emergency_alerts(toda_id);
create index if not exists idx_emergency_alerts_barangay_id on public.emergency_alerts(barangay_id);
create index if not exists idx_emergency_alerts_passenger_location
  on public.emergency_alerts(passenger_latitude, passenger_longitude)
  where passenger_latitude is not null and passenger_longitude is not null;

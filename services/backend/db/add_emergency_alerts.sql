create type emergency_alert_status as enum (
  'created',
  'pending_admin',
  'acknowledged',
  'responding',
  'resolved'
);

create table public.emergency_alerts (
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

create index idx_emergency_alerts_status on public.emergency_alerts(status);
create index idx_emergency_alerts_created_at on public.emergency_alerts(created_at desc);
create index idx_emergency_alerts_driver_id on public.emergency_alerts(driver_id);
create index idx_emergency_alerts_trip_id on public.emergency_alerts(trip_id);
create index idx_emergency_alerts_toda_id on public.emergency_alerts(toda_id);
create index idx_emergency_alerts_barangay_id on public.emergency_alerts(barangay_id);

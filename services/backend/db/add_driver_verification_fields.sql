alter table public.drivers
  add column if not exists created_by_admin boolean not null default true,
  add column if not exists is_verified boolean not null default false,
  add column if not exists verification_status text not null default 'pending',
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by bigint references public.admin_accounts(admin_id) on delete set null;

alter table public.qr_codes
  add column if not exists issued_by_admin boolean not null default true,
  add column if not exists revoked_at timestamptz;

update public.drivers
set
  created_by_admin = true,
  is_verified = true,
  verification_status = 'verified',
  verified_at = coalesce(verified_at, created_at)
where deleted_at is null
  and status = 'active'
  and driver_code is not null;

update public.qr_codes
set issued_by_admin = true
where issued_by_admin is distinct from true;

create table if not exists public.suspicious_qr_reports (
  suspicious_report_id bigint generated always as identity primary key,
  qr_token text not null,
  report_type_code text not null default 'suspicious_qr',
  passenger_name text,
  passenger_contact text,
  description text not null,
  device_info jsonb,
  status text not null default 'submitted',
  created_at timestamptz not null default now()
);

create index if not exists idx_suspicious_qr_reports_created_at
  on public.suspicious_qr_reports(created_at desc);

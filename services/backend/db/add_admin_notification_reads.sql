create table if not exists public.admin_notification_reads (
  admin_id bigint not null references public.admin_accounts(admin_id) on delete cascade,
  notification_key text not null,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (admin_id, notification_key)
);

create index if not exists idx_admin_notification_reads_admin_read_at
on public.admin_notification_reads(admin_id, read_at desc);

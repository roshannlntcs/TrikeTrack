alter table if exists public.violation_appeals
add column if not exists admin_viewed_at timestamptz;

alter table if exists public.violation_appeals
add column if not exists admin_viewed_by_admin_id bigint
references public.admin_accounts(admin_id) on delete set null;

create index if not exists idx_violation_appeals_admin_viewed_at
on public.violation_appeals(admin_viewed_at desc nulls last);

create index if not exists idx_violation_appeals_admin_viewed_by
on public.violation_appeals(admin_viewed_by_admin_id);

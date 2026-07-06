-- Add admin viewing tracking to reports table
-- This allows tracking which reports have been viewed by admins

alter table if exists public.reports
  add column if not exists admin_viewed_at timestamptz,
  add column if not exists admin_viewed_by_admin_id bigint references public.admin_accounts(admin_id) on delete set null;

-- Create index for efficient filtering of unread reports
create index if not exists idx_reports_admin_viewed_at on public.reports(admin_viewed_at) where admin_viewed_at is null;
create index if not exists idx_reports_admin_viewed_by on public.reports(admin_viewed_by_admin_id);

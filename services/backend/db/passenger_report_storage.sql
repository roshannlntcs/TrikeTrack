-- Run this in the Supabase SQL Editor for your TrikeTrack project.
-- This creates a public bucket for passenger-submitted proof images.

insert into storage.buckets (id, name, public)
values ('passenger-report-media', 'passenger-report-media', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public_can_read_passenger_report_media'
  ) then
    create policy public_can_read_passenger_report_media
    on storage.objects
    for select
    to public
    using (bucket_id = 'passenger-report-media');
  end if;
end $$;

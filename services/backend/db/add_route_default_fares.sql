-- Route-level fare reference for passenger QR fare checking before trip end.
-- Run after add_mobile_shared_tables.sql.

alter table if exists public.routes
add column if not exists default_fare_amount numeric(10,2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'route_default_fare_check'
      and conrelid = 'public.routes'::regclass
  ) then
    alter table public.routes
    add constraint route_default_fare_check
    check (default_fare_amount is null or default_fare_amount >= 0);
  end if;
end $$;

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception
  when others then null;
end $$;

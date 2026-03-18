alter table public.drivers
add column if not exists driver_code text generated always as (
  'D-' || lpad(driver_id::text, 3, '0')
) stored;

create unique index if not exists idx_drivers_driver_code
on public.drivers(driver_code);

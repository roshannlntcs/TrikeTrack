alter table public.violations
add column if not exists latitude double precision;

alter table public.violations
add column if not exists longitude double precision;

alter table public.violations
add column if not exists location_label text;

alter table public.violations
add column if not exists dedupe_key text;

create unique index if not exists uq_violations_dedupe_key
on public.violations(dedupe_key)
where dedupe_key is not null;

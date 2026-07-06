update public.routes
set
  origin = 'Obrero',
  destination = 'Route'
where lower(trim(origin)) = 'test route'
  and lower(trim(destination)) = 'live gps tracking';

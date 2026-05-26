-- Track whether auth login is disabled (user may still be linked via auth_user_id)

alter table public.doctors
  add column if not exists login_disabled boolean not null default false;

alter table public.patients
  add column if not exists login_disabled boolean not null default false;

comment on column public.doctors.login_disabled is 'When true, Supabase Auth user is banned; admin can re-enable login';
comment on column public.patients.login_disabled is 'When true, Supabase Auth user is banned; admin can re-enable login';

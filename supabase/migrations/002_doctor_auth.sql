-- Doctor contact + link to Supabase Auth (passwords live in auth.users only)

alter table public.doctors
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null;

create unique index if not exists doctors_email_idx on public.doctors (lower(email));
create index if not exists doctors_auth_user_idx on public.doctors (auth_user_id);

comment on column public.doctors.email is 'Login email (Supabase Auth)';
comment on column public.doctors.phone is 'Contact phone (E.164 or formatted)';
comment on column public.doctors.auth_user_id is 'Linked auth.users id — password never stored here';

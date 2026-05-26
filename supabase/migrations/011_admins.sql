-- Platform administrators (login via Supabase Auth; passwords only in auth.users)

create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default 'Administrator',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists admins_email_idx on public.admins (lower(email));
create index if not exists admins_auth_user_idx on public.admins (auth_user_id);

comment on table public.admins is 'Platform admins; auth_user_id links to Supabase Auth';
comment on column public.admins.email is 'Login email (Supabase Auth)';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins a
    where a.auth_user_id = auth.uid()
      and a.is_active = true
  );
$$;

alter table public.admins enable row level security;

drop policy if exists "admins_select_own" on public.admins;
create policy "admins_select_own"
  on public.admins
  for select
  to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists "patients_select_admins" on public.patients;
create policy "patients_select_admins"
  on public.patients
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "uploaded_files_select_admins" on public.uploaded_files;
create policy "uploaded_files_select_admins"
  on public.uploaded_files
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "opinion_requests_select_admins" on public.opinion_requests;
create policy "opinion_requests_select_admins"
  on public.opinion_requests
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "opinion_request_records_select_admins" on public.opinion_request_records;
create policy "opinion_request_records_select_admins"
  on public.opinion_request_records
  for select
  to authenticated
  using (public.is_admin());

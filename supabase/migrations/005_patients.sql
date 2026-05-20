-- Patient profiles linked to Supabase Auth (mirrors doctors table pattern)

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  date_of_birth date,
  gender text,
  blood_group text,
  country text,
  city text,
  allergies text,
  current_medications text,
  insurance_provider text,
  emergency_contact_name text,
  emergency_contact_phone text,
  preferred_language text not null default 'en',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists patients_email_idx on public.patients (lower(email));
create index if not exists patients_auth_user_idx on public.patients (auth_user_id);
create index if not exists patients_country_idx on public.patients (country);

comment on table public.patients is 'Registered patients; auth_user_id links to Supabase Auth login';

-- Link uploads to patient record (optional; user_id remains auth uid for Storage RLS)
alter table public.uploaded_files
  add column if not exists patient_id uuid references public.patients (id) on delete set null;

create index if not exists uploaded_files_patient_id_idx on public.uploaded_files (patient_id)
  where patient_id is not null;

-- Backfill patient_id from auth user when a patients row exists
update public.uploaded_files uf
set patient_id = p.id
from public.patients p
where uf.user_id = p.auth_user_id
  and uf.patient_id is null;

alter table public.patients enable row level security;

drop policy if exists "patients_select_own" on public.patients;
create policy "patients_select_own"
  on public.patients
  for select
  to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists "patients_select_doctors" on public.patients;
create policy "patients_select_doctors"
  on public.patients
  for select
  to authenticated
  using (
    exists (
      select 1 from public.doctors d
      where d.auth_user_id = auth.uid()
    )
  );

drop policy if exists "patients_insert_own" on public.patients;
create policy "patients_insert_own"
  on public.patients
  for insert
  to authenticated
  with check (auth_user_id = auth.uid());

drop policy if exists "patients_update_own" on public.patients;
create policy "patients_update_own"
  on public.patients
  for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Patients may read their own uploads via patient_id or user_id
drop policy if exists "uploaded_files_select" on public.uploaded_files;
create policy "uploaded_files_select"
  on public.uploaded_files
  for select
  to anon, authenticated
  using (
    user_id is null
    or user_id = auth.uid()
    or exists (
      select 1 from public.patients p
      where p.id = uploaded_files.patient_id
        and p.auth_user_id = auth.uid()
    )
  );

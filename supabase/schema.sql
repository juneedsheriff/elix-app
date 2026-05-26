-- =============================================================================
-- Second Opinion Doctor — full schema (run once in Supabase SQL Editor)
-- Dashboard → SQL Editor → New query → paste this file → Run
-- Then locally: npm run db:seed && npm run db:seed-records
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Doctors
-- -----------------------------------------------------------------------------
create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  gender text,
  mobile_no text,
  email text,
  medical_license_no text,
  qualification text,
  start_of_practice date,
  specialty text not null,
  specialization text,
  about_doctor text,
  work_experience text,
  awards_recognitions text,
  membership text,
  clinic_name text,
  clinic_specialization text,
  about_clinic text,
  clinic_website text,
  clinic_country text,
  clinic_state text,
  clinic_city text,
  clinic_location text,
  clinic_street text,
  clinic_zipcode text,
  scheduler_effect_from date,
  scheduler_time_interval integer check (scheduler_time_interval is null or scheduler_time_interval > 0),
  consultation_fee integer check (consultation_fee is null or consultation_fee >= 0),
  elix_patient_priority boolean not null default false,
  scheduler_color text default '#09abc0',
  consultation_hours jsonb not null default '{}'::jsonb,
  time_settings jsonb not null default '{}'::jsonb,
  years_experience integer not null check (years_experience >= 0) default 0,
  hospital text not null default '',
  rating numeric(3, 2) not null check (rating >= 0 and rating <= 5) default 4.5,
  languages text not null default 'English',
  fee_usd integer not null check (fee_usd >= 0) default 0,
  image_url text not null default '',
  country text not null default '',
  bio text,
  phone text,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists doctors_specialty_idx on public.doctors (specialty);
create index if not exists doctors_rating_idx on public.doctors (rating desc);
create unique index if not exists doctors_email_idx on public.doctors (lower(email));
create index if not exists doctors_auth_user_idx on public.doctors (auth_user_id);

alter table public.doctors enable row level security;

drop policy if exists "doctors_select_public" on public.doctors;
create policy "doctors_select_public"
  on public.doctors for select to anon, authenticated using (true);

drop policy if exists "doctors_update_admins" on public.doctors;
create policy "doctors_update_admins"
  on public.doctors for update to authenticated
  using (public.is_administrator()) with check (public.is_administrator());

-- -----------------------------------------------------------------------------
-- Admins
-- -----------------------------------------------------------------------------
create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default 'Administrator',
  role text not null default 'administrator'
    check (role in ('administrator', 'patient_service_executive')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists admins_email_idx on public.admins (lower(email));
create index if not exists admins_auth_user_idx on public.admins (auth_user_id);

create or replace function public.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.id from public.admins a
  where a.auth_user_id = auth.uid() and a.is_active = true
  limit 1;
$$;

create or replace function public.staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select a.role from public.admins a
  where a.auth_user_id = auth.uid() and a.is_active = true
  limit 1;
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_staff_id() is not null;
$$;

create or replace function public.is_administrator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.staff_role() = 'administrator';
$$;

create or replace function public.is_patient_service_executive()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.staff_role() = 'patient_service_executive';
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff();
$$;

alter table public.admins enable row level security;

drop policy if exists "admins_select_own" on public.admins;
create policy "admins_select_own"
  on public.admins for select to authenticated using (auth_user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Patients
-- -----------------------------------------------------------------------------
create sequence if not exists public.patient_elix_id_seq;

create or replace function public.generate_patient_elix_id()
returns text
language plpgsql
as $$
declare
  n bigint;
  pair_index bigint;
  num_part int;
  first_letter text;
  second_letter text;
begin
  n := nextval('public.patient_elix_id_seq') - 1;
  if n >= 6760000 then
    raise exception 'patient elix_id sequence exhausted (max 6,760,000 IDs)';
  end if;
  pair_index := n / 10000;
  num_part := (n % 10000)::int;
  first_letter := chr(97 + ((pair_index / 26) % 26)::int);
  second_letter := chr(97 + (pair_index % 26)::int);
  return 'elix-' || first_letter || second_letter || lpad(num_part::text, 4, '0');
end;
$$;

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  elix_id text not null,
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
create unique index if not exists patients_elix_id_idx on public.patients (elix_id);
create index if not exists patients_auth_user_idx on public.patients (auth_user_id);

alter table public.patients
  add constraint patients_elix_id_format_chk
  check (elix_id ~ '^elix-[a-z]{2}[0-9]{4}$');

create or replace function public.set_patient_elix_id()
returns trigger
language plpgsql
as $$
begin
  if new.elix_id is null or btrim(new.elix_id) = '' then
    new.elix_id := public.generate_patient_elix_id();
  end if;
  return new;
end;
$$;

drop trigger if exists patients_set_elix_id on public.patients;
create trigger patients_set_elix_id
  before insert on public.patients
  for each row
  execute function public.set_patient_elix_id();

alter table public.patients enable row level security;

drop policy if exists "patients_select_own" on public.patients;
create policy "patients_select_own"
  on public.patients for select to authenticated using (auth_user_id = auth.uid());

drop policy if exists "patients_select_doctors" on public.patients;
create policy "patients_select_doctors"
  on public.patients for select to authenticated
  using (exists (select 1 from public.doctors d where d.auth_user_id = auth.uid()));

drop policy if exists "patients_insert_own" on public.patients;
create policy "patients_insert_own"
  on public.patients for insert to authenticated with check (auth_user_id = auth.uid());

drop policy if exists "patients_update_own" on public.patients;
create policy "patients_update_own"
  on public.patients for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

drop policy if exists "patients_select_admins" on public.patients;
create policy "patients_select_admins"
  on public.patients for select to authenticated using (public.is_admin());

drop policy if exists "patients_update_admins" on public.patients;
create policy "patients_update_admins"
  on public.patients for update to authenticated
  using (public.is_administrator()) with check (public.is_administrator());

-- -----------------------------------------------------------------------------
-- Uploaded files + opinion requests
-- -----------------------------------------------------------------------------
create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  patient_id uuid references public.patients (id) on delete set null,
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  file_size_bytes bigint not null default 0 check (file_size_bytes >= 0),
  storage_bucket text not null default 'medical-records',
  storage_path text not null,
  summary text,
  uploaded_at timestamptz not null default now()
);

create unique index if not exists uploaded_files_storage_path_idx on public.uploaded_files (storage_path);
create index if not exists uploaded_files_user_idx on public.uploaded_files (user_id);
create index if not exists uploaded_files_uploaded_at_idx on public.uploaded_files (uploaded_at desc);

create table if not exists public.opinion_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references auth.users (id) on delete set null,
  patient_name text,
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  doctor_name text,
  doctor_response text,
  responded_at timestamptz,
  assigned_to uuid references public.admins (id) on delete set null,
  assigned_at timestamptz,
  coordination_notes text,
  message text not null,
  status text not null default 'submitted'
    check (status in ('submitted', 'in_review', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.opinion_request_records (
  request_id uuid not null references public.opinion_requests (id) on delete cascade,
  record_id uuid not null references public.uploaded_files (id) on delete cascade,
  primary key (request_id, record_id)
);
create index if not exists opinion_requests_assigned_to_idx on public.opinion_requests (assigned_to);
create index if not exists opinion_requests_doctor_idx on public.opinion_requests (doctor_id);
create index if not exists opinion_requests_patient_idx on public.opinion_requests (patient_id);

alter table public.uploaded_files enable row level security;
alter table public.opinion_requests enable row level security;
alter table public.opinion_request_records enable row level security;

drop policy if exists "uploaded_files_select" on public.uploaded_files;
create policy "uploaded_files_select"
  on public.uploaded_files for select to anon, authenticated
  using (
    user_id is null
    or user_id = auth.uid()
    or exists (
      select 1 from public.patients p
      where p.id = uploaded_files.patient_id and p.auth_user_id = auth.uid()
    )
  );

drop policy if exists "uploaded_files_select_doctor_request" on public.uploaded_files;
create policy "uploaded_files_select_doctor_request"
  on public.uploaded_files for select to authenticated
  using (
    exists (
      select 1 from public.opinion_request_records orr
      join public.opinion_requests oreq on oreq.id = orr.request_id
      join public.doctors d on d.id = oreq.doctor_id
      where orr.record_id = uploaded_files.id
        and oreq.status in ('in_review', 'closed')
        and d.auth_user_id = auth.uid()
    )
  );

drop policy if exists "uploaded_files_insert" on public.uploaded_files;
create policy "uploaded_files_insert"
  on public.uploaded_files for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "uploaded_files_delete" on public.uploaded_files;
create policy "uploaded_files_delete"
  on public.uploaded_files for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "uploaded_files_update" on public.uploaded_files;
create policy "uploaded_files_update"
  on public.uploaded_files for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "uploaded_files_select_admins" on public.uploaded_files;
create policy "uploaded_files_select_admins"
  on public.uploaded_files for select to authenticated using (public.is_admin());

drop policy if exists "opinion_requests_select" on public.opinion_requests;
create policy "opinion_requests_select"
  on public.opinion_requests for select to anon, authenticated
  using (patient_id is null or patient_id = auth.uid());

drop policy if exists "opinion_requests_select_doctor" on public.opinion_requests;
create policy "opinion_requests_select_doctor"
  on public.opinion_requests for select to authenticated
  using (
    opinion_requests.status in ('in_review', 'closed')
    and exists (
      select 1 from public.doctors d
      where d.id = opinion_requests.doctor_id and d.auth_user_id = auth.uid()
    )
  );

drop policy if exists "opinion_requests_insert" on public.opinion_requests;
create policy "opinion_requests_insert"
  on public.opinion_requests for insert to anon, authenticated with check (true);

drop policy if exists "opinion_requests_update_doctor" on public.opinion_requests;
create policy "opinion_requests_update_doctor"
  on public.opinion_requests for update to authenticated
  using (
    exists (
      select 1 from public.doctors d
      where d.id = opinion_requests.doctor_id and d.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.doctors d
      where d.id = opinion_requests.doctor_id and d.auth_user_id = auth.uid()
    )
  );

drop policy if exists "opinion_request_records_select" on public.opinion_request_records;
create policy "opinion_request_records_select"
  on public.opinion_request_records for select to anon, authenticated using (true);

drop policy if exists "opinion_request_records_insert" on public.opinion_request_records;
create policy "opinion_request_records_insert"
  on public.opinion_request_records for insert to anon, authenticated with check (true);

drop policy if exists "uploaded_files_select_pse_assigned" on public.uploaded_files;
create policy "uploaded_files_select_pse_assigned"
  on public.uploaded_files for select to authenticated
  using (
    public.is_patient_service_executive()
    and exists (
      select 1 from public.opinion_request_records orr
      join public.opinion_requests oreq on oreq.id = orr.request_id
      where orr.record_id = uploaded_files.id
        and oreq.assigned_to = public.current_staff_id()
    )
  );

drop policy if exists "opinion_requests_select_admins" on public.opinion_requests;
drop policy if exists "opinion_requests_select_staff" on public.opinion_requests;
create policy "opinion_requests_select_staff"
  on public.opinion_requests for select to authenticated
  using (
    public.is_administrator()
    or (
      public.is_patient_service_executive()
      and assigned_to = public.current_staff_id()
    )
  );

drop policy if exists "opinion_requests_update_admins" on public.opinion_requests;
drop policy if exists "opinion_requests_update_administrator" on public.opinion_requests;
create policy "opinion_requests_update_administrator"
  on public.opinion_requests for update to authenticated
  using (public.is_administrator()) with check (public.is_administrator());

drop policy if exists "opinion_requests_update_pse" on public.opinion_requests;
create policy "opinion_requests_update_pse"
  on public.opinion_requests for update to authenticated
  using (
    public.is_patient_service_executive()
    and assigned_to = public.current_staff_id()
  )
  with check (
    public.is_patient_service_executive()
    and assigned_to = public.current_staff_id()
  );

drop policy if exists "opinion_request_records_select_admins" on public.opinion_request_records;
drop policy if exists "opinion_request_records_select_staff" on public.opinion_request_records;
create policy "opinion_request_records_select_staff"
  on public.opinion_request_records for select to authenticated using (public.is_staff());

drop policy if exists "admins_select_all_admins" on public.admins;
create policy "admins_select_all_admins"
  on public.admins for select to authenticated using (public.is_administrator());

drop policy if exists "admins_select_staff_directory" on public.admins;
create policy "admins_select_staff_directory"
  on public.admins for select to authenticated
  using (
    public.is_administrator()
    or (
      public.is_patient_service_executive()
      and role = 'patient_service_executive'
      and is_active = true
    )
  );

-- -----------------------------------------------------------------------------
-- Storage bucket for uploads (PDF, JPG, DOC)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'medical-records',
  'medical-records',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "medical_records_storage_insert" on storage.objects;
create policy "medical_records_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'medical-records'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

drop policy if exists "medical_records_storage_select" on storage.objects;
create policy "medical_records_storage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'medical-records'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

drop policy if exists "medical_records_storage_select_doctor" on storage.objects;
create policy "medical_records_storage_select_doctor"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'medical-records'
    and exists (
      select 1 from public.uploaded_files uf
      join public.opinion_request_records orr on orr.record_id = uf.id
      join public.opinion_requests oreq on oreq.id = orr.request_id
      join public.doctors d on d.id = oreq.doctor_id
      where uf.storage_path = name
        and oreq.status in ('in_review', 'closed')
        and d.auth_user_id = auth.uid()
    )
  );

drop policy if exists "medical_records_storage_delete" on storage.objects;
create policy "medical_records_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'medical-records'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

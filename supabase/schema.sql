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
  specialty text not null,
  years_experience integer not null check (years_experience >= 0),
  hospital text not null,
  rating numeric(3, 2) not null check (rating >= 0 and rating <= 5),
  languages text not null,
  fee_usd integer not null check (fee_usd >= 0),
  image_url text not null,
  country text not null,
  bio text,
  email text,
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

-- -----------------------------------------------------------------------------
-- Patients
-- -----------------------------------------------------------------------------
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
      where orr.record_id = uploaded_files.id and d.auth_user_id = auth.uid()
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

drop policy if exists "opinion_requests_select" on public.opinion_requests;
create policy "opinion_requests_select"
  on public.opinion_requests for select to anon, authenticated
  using (patient_id is null or patient_id = auth.uid());

drop policy if exists "opinion_requests_select_doctor" on public.opinion_requests;
create policy "opinion_requests_select_doctor"
  on public.opinion_requests for select to authenticated
  using (
    exists (
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
      where uf.storage_path = name and d.auth_user_id = auth.uid()
    )
  );

drop policy if exists "medical_records_storage_delete" on storage.objects;
create policy "medical_records_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'medical-records'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

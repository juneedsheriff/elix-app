-- Run this entire file once in Supabase Dashboard → SQL Editor
-- Fixes: doctor can read requests (006) + doctor can respond to patients (009)
-- Also run migrations/010_patient_elix_id.sql (or npm run db:apply-elix-id with POSTGRES_URL set)

-- 006: doctor read access
drop policy if exists "opinion_requests_select_doctor" on public.opinion_requests;
create policy "opinion_requests_select_doctor"
  on public.opinion_requests for select to authenticated
  using (
    exists (
      select 1 from public.doctors d
      where d.id = opinion_requests.doctor_id and d.auth_user_id = auth.uid()
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

-- 007: names (safe if already applied)
alter table public.opinion_requests
  add column if not exists patient_name text,
  add column if not exists doctor_name text;

-- 009: doctor response columns
alter table public.opinion_requests
  add column if not exists doctor_response text,
  add column if not exists responded_at timestamptz;

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

-- 010: patient elix_id (elix-aa0000)
-- Or run: npm run db:apply-elix-id

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

alter table public.patients
  add column if not exists elix_id text;

do $$
declare
  r record;
begin
  for r in
    select id from public.patients
    where elix_id is null
    order by created_at asc, id asc
  loop
    update public.patients
    set elix_id = public.generate_patient_elix_id()
    where id = r.id;
  end loop;
end;
$$;

select setval(
  'public.patient_elix_id_seq',
  greatest(1, coalesce((select count(*) from public.patients), 0)),
  true
);

alter table public.patients
  alter column elix_id set not null;

alter table public.patients
  drop constraint if exists patients_elix_id_format_chk;

alter table public.patients
  add constraint patients_elix_id_format_chk
  check (elix_id ~ '^elix-[a-z]{2}[0-9]{4}$');

create unique index if not exists patients_elix_id_idx on public.patients (elix_id);

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

-- 013: admin can update doctor/patient profiles
drop policy if exists "doctors_update_admins" on public.doctors;
create policy "doctors_update_admins"
  on public.doctors for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "patients_update_admins" on public.patients;
create policy "patients_update_admins"
  on public.patients for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 014: extended doctor profile columns (fixes "column doctors.gender does not exist")
alter table public.doctors
  add column if not exists gender text,
  add column if not exists mobile_no text,
  add column if not exists medical_license_no text,
  add column if not exists qualification text,
  add column if not exists start_of_practice date,
  add column if not exists specialization text,
  add column if not exists about_doctor text,
  add column if not exists work_experience text,
  add column if not exists awards_recognitions text,
  add column if not exists membership text,
  add column if not exists clinic_name text,
  add column if not exists clinic_specialization text,
  add column if not exists about_clinic text,
  add column if not exists clinic_website text,
  add column if not exists clinic_country text,
  add column if not exists clinic_state text,
  add column if not exists clinic_city text,
  add column if not exists clinic_location text,
  add column if not exists clinic_street text,
  add column if not exists clinic_zipcode text,
  add column if not exists scheduler_effect_from date,
  add column if not exists scheduler_time_interval integer check (scheduler_time_interval is null or scheduler_time_interval > 0),
  add column if not exists consultation_fee integer check (consultation_fee is null or consultation_fee >= 0),
  add column if not exists elix_patient_priority boolean not null default false,
  add column if not exists scheduler_color text default '#09abc0',
  add column if not exists consultation_hours jsonb not null default '{}'::jsonb,
  add column if not exists time_settings jsonb not null default '{}'::jsonb;

update public.doctors
set
  mobile_no = coalesce(nullif(trim(mobile_no), ''), nullif(trim(phone), '')),
  about_doctor = coalesce(nullif(trim(about_doctor), ''), bio),
  clinic_name = coalesce(nullif(trim(clinic_name), ''), hospital),
  clinic_country = coalesce(nullif(trim(clinic_country), ''), country),
  consultation_fee = coalesce(consultation_fee, fee_usd),
  specialization = coalesce(nullif(trim(specialization), ''), specialty)
where true;

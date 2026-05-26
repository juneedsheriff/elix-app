-- Extended doctor profile: personal, professional, clinic, and scheduler fields

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

comment on column public.doctors.mobile_no is 'Doctor mobile contact';
comment on column public.doctors.consultation_hours is 'Weekly consultation schedule (JSON)';
comment on column public.doctors.time_settings is 'Scheduler time settings (JSON)';

-- Backfill from legacy columns
update public.doctors
set
  mobile_no = coalesce(nullif(trim(mobile_no), ''), nullif(trim(phone), '')),
  about_doctor = coalesce(nullif(trim(about_doctor), ''), bio),
  clinic_name = coalesce(nullif(trim(clinic_name), ''), hospital),
  clinic_country = coalesce(nullif(trim(clinic_country), ''), country),
  consultation_fee = coalesce(consultation_fee, fee_usd),
  specialization = coalesce(nullif(trim(specialization), ''), specialty)
where true;

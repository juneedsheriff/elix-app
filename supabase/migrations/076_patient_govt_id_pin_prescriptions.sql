-- Patient identity, location, and profile document references.

alter table public.patients
  add column if not exists pin_code text;

alter table public.patients
  add column if not exists govt_id_type text;

alter table public.patients
  add column if not exists govt_id_number text;

-- Address may already exist from earlier profile migrations.
alter table public.patients
  add column if not exists address text;

-- Arrays of { id, storage_path, file_name, mime_type, uploaded_at }
alter table public.patients
  add column if not exists govt_id_documents jsonb not null default '[]'::jsonb;

alter table public.patients
  add column if not exists latest_prescription_documents jsonb not null default '[]'::jsonb;

comment on column public.patients.pin_code is 'Postal / PIN code for the patient address.';
comment on column public.patients.govt_id_type is 'Government ID type (Aadhar, PAN, etc.).';
comment on column public.patients.govt_id_number is 'Government ID number (optional).';
comment on column public.patients.govt_id_documents is 'JSON array of uploaded govt ID document metadata.';
comment on column public.patients.latest_prescription_documents is
  'JSON array of latest prescription uploads linked to current medications.';

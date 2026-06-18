-- Patient / PSE proceed without attached medical records

alter table public.opinion_requests
  add column if not exists patient_proceeded_without_records_at timestamptz,
  add column if not exists pse_proceeded_without_records_at timestamptz;

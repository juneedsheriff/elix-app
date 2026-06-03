-- Patient payment screenshot / receipt shared after paying via external link

alter table public.opinion_requests
  add column if not exists payment_proof_storage_path text,
  add column if not exists payment_proof_file_name text,
  add column if not exists payment_proof_mime_type text,
  add column if not exists payment_proof_submitted_at timestamptz;

comment on column public.opinion_requests.payment_proof_storage_path is 'R2 object path for patient-uploaded payment proof';
comment on column public.opinion_requests.payment_proof_submitted_at is 'When the patient shared payment proof with PSE';

create index if not exists opinion_requests_payment_proof_submitted_at_idx
  on public.opinion_requests (payment_proof_submitted_at)
  where payment_proof_submitted_at is not null;

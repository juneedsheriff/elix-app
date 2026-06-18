-- Structured patient case details for second opinion requests

alter table public.opinion_requests
  add column if not exists patient_case_details jsonb,
  add column if not exists case_details_reviewed_at timestamptz,
  add column if not exists records_rejected_at timestamptz,
  add column if not exists records_rejection_reason text;

create index if not exists opinion_requests_case_details_reviewed_idx
  on public.opinion_requests (case_details_reviewed_at)
  where case_details_reviewed_at is not null;

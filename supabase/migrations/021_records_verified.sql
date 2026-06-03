-- Track when PSE has verified patient-uploaded records (wizard step 2)

alter table public.opinion_requests
  add column if not exists records_verified_at timestamptz;

create index if not exists opinion_requests_records_verified_at_idx
  on public.opinion_requests (records_verified_at)
  where records_verified_at is not null;

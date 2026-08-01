-- Home care clinic PSE coordination: remarks + follow-up date (visible to patient)

alter table public.opinion_requests
  add column if not exists home_care_remarks text,
  add column if not exists home_care_followup_date date;

comment on column public.opinion_requests.home_care_remarks is
  'Clinic PSE remarks for home care coordination; visible to the patient.';
comment on column public.opinion_requests.home_care_followup_date is
  'Clinic PSE follow-up date for home care; visible to the patient.';

create index if not exists opinion_requests_home_care_followup_date_idx
  on public.opinion_requests (home_care_followup_date)
  where home_care_followup_date is not null;

-- Patient-preferred specialty for recommendation-only second opinion requests.

alter table public.opinion_requests
  add column if not exists requested_specialty text;

create index if not exists opinion_requests_requested_specialty_idx
  on public.opinion_requests (requested_specialty);

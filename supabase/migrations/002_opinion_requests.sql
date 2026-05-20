-- Medical records and second-opinion requests (links to public.doctors)

create table if not exists public.medical_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references auth.users (id) on delete cascade,
  file_name text not null,
  file_type text not null default 'application/pdf',
  summary text,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.opinion_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references auth.users (id) on delete set null,
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  message text not null,
  status text not null default 'submitted' check (status in ('submitted', 'in_review', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.opinion_request_records (
  request_id uuid not null references public.opinion_requests (id) on delete cascade,
  record_id uuid not null references public.medical_records (id) on delete cascade,
  primary key (request_id, record_id)
);

create index if not exists medical_records_patient_idx on public.medical_records (patient_id);
create index if not exists opinion_requests_doctor_idx on public.opinion_requests (doctor_id);
create index if not exists opinion_requests_patient_idx on public.opinion_requests (patient_id);

alter table public.medical_records enable row level security;
alter table public.opinion_requests enable row level security;
alter table public.opinion_request_records enable row level security;

drop policy if exists "medical_records_select" on public.medical_records;
create policy "medical_records_select"
  on public.medical_records
  for select
  to anon, authenticated
  using (patient_id is null or patient_id = auth.uid());

drop policy if exists "medical_records_insert_own" on public.medical_records;
create policy "medical_records_insert_own"
  on public.medical_records
  for insert
  to authenticated
  with check (patient_id = auth.uid());

drop policy if exists "opinion_requests_select" on public.opinion_requests;
create policy "opinion_requests_select"
  on public.opinion_requests
  for select
  to anon, authenticated
  using (patient_id is null or patient_id = auth.uid());

drop policy if exists "opinion_requests_insert" on public.opinion_requests;
create policy "opinion_requests_insert"
  on public.opinion_requests
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "opinion_request_records_select" on public.opinion_request_records;
create policy "opinion_request_records_select"
  on public.opinion_request_records
  for select
  to anon, authenticated
  using (true);

drop policy if exists "opinion_request_records_insert" on public.opinion_request_records;
create policy "opinion_request_records_insert"
  on public.opinion_request_records
  for insert
  to anon, authenticated
  with check (true);

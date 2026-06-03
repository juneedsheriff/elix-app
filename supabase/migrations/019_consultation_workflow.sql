-- Consultation workflow extensions on top of opinion_requests
-- Adds: stage tracking, recommendations, scheduling/payment metadata, structured consultation summary

-- -----------------------------------------------------------------------------
-- opinion_requests workflow columns
-- -----------------------------------------------------------------------------
alter table public.opinion_requests
  add column if not exists consultation_stage text not null default 'new'
    check (
      consultation_stage in (
        'new',
        'assigned',
        'recommended',
        'doctor_selected',
        'availability_submitted',
        'scheduled',
        'payment_pending',
        'paid',
        'completed'
      )
    ),
  add column if not exists selected_doctor_id uuid references public.doctors (id) on delete set null,
  add column if not exists patient_availability jsonb,
  add column if not exists scheduled_at timestamptz,
  add column if not exists meeting_link text,
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'paid')),
  add column if not exists payment_amount numeric,
  add column if not exists payment_currency text,
  add column if not exists payment_reference text,
  add column if not exists payment_confirmed_at timestamptz;

create index if not exists opinion_requests_consultation_stage_idx
  on public.opinion_requests (consultation_stage);
create index if not exists opinion_requests_selected_doctor_idx
  on public.opinion_requests (selected_doctor_id);

-- -----------------------------------------------------------------------------
-- Recommendations (PSE curated list)
-- -----------------------------------------------------------------------------
create table if not exists public.opinion_request_recommendations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.opinion_requests (id) on delete cascade,
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  rank integer,
  note text,
  created_at timestamptz not null default now(),
  unique (request_id, doctor_id)
);

create index if not exists opinion_request_recommendations_request_idx
  on public.opinion_request_recommendations (request_id);
create index if not exists opinion_request_recommendations_doctor_idx
  on public.opinion_request_recommendations (doctor_id);

alter table public.opinion_request_recommendations enable row level security;

drop policy if exists "recommendations_select_patient" on public.opinion_request_recommendations;
create policy "recommendations_select_patient"
  on public.opinion_request_recommendations for select to authenticated
  using (
    exists (
      select 1
      from public.opinion_requests r
      where r.id = opinion_request_recommendations.request_id
        and r.patient_id = auth.uid()
    )
  );

drop policy if exists "recommendations_select_staff" on public.opinion_request_recommendations;
create policy "recommendations_select_staff"
  on public.opinion_request_recommendations for select to authenticated
  using (
    public.is_staff()
  );

drop policy if exists "recommendations_write_pse" on public.opinion_request_recommendations;
create policy "recommendations_write_pse"
  on public.opinion_request_recommendations for all to authenticated
  using (
    public.is_patient_service_executive()
    and exists (
      select 1
      from public.opinion_requests r
      where r.id = opinion_request_recommendations.request_id
        and r.assigned_to = public.current_staff_id()
    )
  )
  with check (
    public.is_patient_service_executive()
    and exists (
      select 1
      from public.opinion_requests r
      where r.id = opinion_request_recommendations.request_id
        and r.assigned_to = public.current_staff_id()
    )
  );

-- -----------------------------------------------------------------------------
-- Structured consultation summaries (doctor after consultation)
-- -----------------------------------------------------------------------------
create table if not exists public.consultation_summaries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.opinion_requests (id) on delete cascade,
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  patient_auth_user_id uuid references auth.users (id) on delete set null,
  chief_complaint text,
  history_present_illness text,
  vital_signs text,
  current_medications text,
  labs_diagnostics text,
  assessment_plan text,
  prescription text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists consultation_summaries_doctor_idx
  on public.consultation_summaries (doctor_id);
create index if not exists consultation_summaries_patient_idx
  on public.consultation_summaries (patient_auth_user_id);

alter table public.consultation_summaries enable row level security;

drop policy if exists "consultation_summaries_select_patient" on public.consultation_summaries;
create policy "consultation_summaries_select_patient"
  on public.consultation_summaries for select to authenticated
  using (patient_auth_user_id = auth.uid());

drop policy if exists "consultation_summaries_select_staff" on public.consultation_summaries;
create policy "consultation_summaries_select_staff"
  on public.consultation_summaries for select to authenticated
  using (public.is_staff());

drop policy if exists "consultation_summaries_write_doctor" on public.consultation_summaries;
create policy "consultation_summaries_write_doctor"
  on public.consultation_summaries for all to authenticated
  using (
    exists (
      select 1
      from public.doctors d
      where d.id = consultation_summaries.doctor_id
        and d.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.doctors d
      where d.id = consultation_summaries.doctor_id
        and d.auth_user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- opinion_requests RLS tweaks (doctor visibility + patient updates)
-- -----------------------------------------------------------------------------

-- Allow doctors to see requests once the consult is paid/scheduled, in addition to legacy in_review/closed gate.
drop policy if exists "opinion_requests_select_doctor" on public.opinion_requests;
create policy "opinion_requests_select_doctor"
  on public.opinion_requests for select to authenticated
  using (
    (
      opinion_requests.status in ('in_review', 'closed')
      or opinion_requests.consultation_stage in ('scheduled', 'paid', 'completed')
    )
    and exists (
      select 1
      from public.doctors d
      where d.id = opinion_requests.doctor_id
        and d.auth_user_id = auth.uid()
    )
  );

-- Patient can update their own request workflow fields (selection/availability).
-- NOTE: RLS cannot restrict columns; UI should only update allowed fields.
drop policy if exists "opinion_requests_update_patient_workflow" on public.opinion_requests;
create policy "opinion_requests_update_patient_workflow"
  on public.opinion_requests for update to authenticated
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());


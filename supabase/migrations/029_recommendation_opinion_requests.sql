-- Allow patients to submit second-opinion requests without pre-selecting a doctor.
-- PSE reviews the case and recommends suitable specialists.

alter table public.opinion_requests
  alter column doctor_id drop not null;

alter table public.opinion_requests
  add column if not exists doctor_selection_mode text not null default 'self_select'
    check (doctor_selection_mode in ('self_select', 'needs_recommendation'));

create index if not exists opinion_requests_doctor_selection_mode_idx
  on public.opinion_requests (doctor_selection_mode);

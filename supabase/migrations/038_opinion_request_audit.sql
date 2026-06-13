-- Activity audit trail for opinion / consultation requests

create table if not exists public.opinion_request_audit_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.opinion_requests (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_role text not null check (actor_role in ('patient', 'pse', 'administrator', 'doctor', 'system')),
  actor_name text,
  action text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists opinion_request_audit_events_request_idx
  on public.opinion_request_audit_events (request_id, created_at desc);

comment on table public.opinion_request_audit_events is
  'Immutable activity log for patient, PSE, admin, and doctor actions on opinion requests.';

alter table public.opinion_request_audit_events enable row level security;

drop policy if exists opinion_request_audit_select on public.opinion_request_audit_events;
create policy opinion_request_audit_select
  on public.opinion_request_audit_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.opinion_requests r
      where r.id = request_id
        and (
          r.patient_id = auth.uid()
          or public.is_staff()
          or exists (
            select 1
            from public.doctors d
            where d.auth_user_id = auth.uid()
              and (d.id = r.doctor_id or d.id = r.selected_doctor_id)
          )
        )
    )
  );

drop policy if exists opinion_request_audit_insert on public.opinion_request_audit_events;
create policy opinion_request_audit_insert
  on public.opinion_request_audit_events
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.opinion_requests r
      where r.id = request_id
        and (
          r.patient_id = auth.uid()
          or public.is_staff()
          or exists (
            select 1
            from public.doctors d
            where d.auth_user_id = auth.uid()
              and (d.id = r.doctor_id or d.id = r.selected_doctor_id)
          )
        )
    )
  );

notify pgrst, 'reload schema';

-- Request-scoped chat between patient and assigned PSE.

create table if not exists public.request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.opinion_requests (id) on delete cascade,
  sender_role text not null check (sender_role in ('patient', 'pse', 'system')),
  sender_auth_user_id uuid not null default auth.uid(),
  sender_staff_id uuid references public.admins (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists request_messages_request_created_idx
  on public.request_messages (request_id, created_at);

alter table public.request_messages enable row level security;
alter table public.request_messages replica identity full;

drop policy if exists "request_messages_select_access" on public.request_messages;
create policy "request_messages_select_access"
  on public.request_messages for select to authenticated
  using (
    exists (
      select 1
      from public.opinion_requests r
      where r.id = request_messages.request_id
        and (
          r.patient_id = auth.uid()
          or public.is_administrator()
          or (
            public.is_platform_patient_service_executive()
            and r.clinic_id is null
            and r.assigned_to = public.current_staff_id()
          )
          or (
            public.is_clinic_patient_service_executive()
            and r.clinic_id = public.current_clinic_id()
            and r.assigned_to = public.current_staff_id()
          )
        )
    )
  );

drop policy if exists "request_messages_insert_access" on public.request_messages;
create policy "request_messages_insert_access"
  on public.request_messages for insert to authenticated
  with check (
    length(trim(body)) > 0
    and exists (
      select 1
      from public.opinion_requests r
      where r.id = request_messages.request_id
        and (
          (
            request_messages.sender_role = 'patient'
            and request_messages.sender_staff_id is null
            and request_messages.sender_auth_user_id = auth.uid()
            and r.patient_id = auth.uid()
          )
          or (
            request_messages.sender_role = 'pse'
            and request_messages.sender_staff_id = public.current_staff_id()
            and request_messages.sender_auth_user_id = auth.uid()
            and (
              (
                public.is_platform_patient_service_executive()
                and r.clinic_id is null
                and r.assigned_to = public.current_staff_id()
              )
              or (
                public.is_clinic_patient_service_executive()
                and r.clinic_id = public.current_clinic_id()
                and r.assigned_to = public.current_staff_id()
              )
            )
          )
        )
    )
  );

alter publication supabase_realtime add table public.request_messages;

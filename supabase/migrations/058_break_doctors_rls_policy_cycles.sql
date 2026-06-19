-- Break RLS cycles between doctors, patients, and opinion_requests.
-- Cycle: patients_select_doctors → doctors → opinion_requests → doctors (infinite recursion).

create or replace function public.is_auth_doctor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_doctor_id() is not null;
$$;

comment on function public.is_auth_doctor() is
  'Whether the signed-in user has a doctor profile (bypasses doctors RLS).';

create or replace function public.doctor_linked_to_auth_patient_request(p_doctor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.opinion_request_recommendations rec
    inner join public.opinion_requests r on r.id = rec.request_id
    where rec.doctor_id = p_doctor_id
      and r.patient_id = auth.uid()
  )
  or exists (
    select 1
    from public.opinion_requests r
    where r.patient_id = auth.uid()
      and (r.doctor_id = p_doctor_id or r.selected_doctor_id = p_doctor_id)
  );
$$;

comment on function public.doctor_linked_to_auth_patient_request(uuid) is
  'Whether a doctor is recommended/assigned on a patient request (bypasses opinion_requests RLS).';

revoke all on function public.is_auth_doctor() from public;
grant execute on function public.is_auth_doctor() to authenticated;

revoke all on function public.doctor_linked_to_auth_patient_request(uuid) from public;
grant execute on function public.doctor_linked_to_auth_patient_request(uuid) to authenticated;

drop policy if exists "patients_select_doctors" on public.patients;
create policy "patients_select_doctors"
  on public.patients for select to authenticated
  using (public.is_auth_doctor());

drop policy if exists "doctors_select_patient_request" on public.doctors;
create policy "doctors_select_patient_request"
  on public.doctors for select to authenticated
  using (
    deleted_at is null
    and public.doctor_linked_to_auth_patient_request(id)
  );

drop policy if exists "opinion_requests_select_doctor" on public.opinion_requests;
create policy "opinion_requests_select_doctor"
  on public.opinion_requests for select to authenticated
  using (
    (
      opinion_requests.status in ('in_review', 'closed')
      or opinion_requests.consultation_stage in ('scheduled', 'paid', 'completed')
    )
    and opinion_requests.doctor_id = public.current_doctor_id()
  );

drop policy if exists "opinion_requests_update_doctor" on public.opinion_requests;
create policy "opinion_requests_update_doctor"
  on public.opinion_requests for update to authenticated
  using (opinion_requests.doctor_id = public.current_doctor_id())
  with check (opinion_requests.doctor_id = public.current_doctor_id());

drop policy if exists "consultation_summaries_select_doctor" on public.consultation_summaries;
create policy "consultation_summaries_select_doctor"
  on public.consultation_summaries for select to authenticated
  using (consultation_summaries.doctor_id = public.current_doctor_id());

drop policy if exists "consultation_summaries_write_doctor" on public.consultation_summaries;
create policy "consultation_summaries_write_doctor"
  on public.consultation_summaries for all to authenticated
  using (consultation_summaries.doctor_id = public.current_doctor_id())
  with check (consultation_summaries.doctor_id = public.current_doctor_id());

alter function public.is_auth_doctor() owner to postgres;
alter function public.doctor_linked_to_auth_patient_request(uuid) owner to postgres;

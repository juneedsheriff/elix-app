-- Allow patients to read consultation summaries for their requests even when
-- patient_auth_user_id on the summary is null/mismatched (clinic create path).

drop policy if exists "consultation_summaries_select_patient" on public.consultation_summaries;
create policy "consultation_summaries_select_patient"
  on public.consultation_summaries for select to authenticated
  using (
    patient_auth_user_id = auth.uid()
    or exists (
      select 1
      from public.opinion_requests r
      where r.id = consultation_summaries.request_id
        and r.patient_id = auth.uid()
    )
  );

comment on policy "consultation_summaries_select_patient" on public.consultation_summaries is
  'Patients can read consultation summaries linked to their auth user or to their opinion requests.';

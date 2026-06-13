-- Explicit SELECT for doctors on their own consultation summaries (PDF preview/download).

drop policy if exists "consultation_summaries_select_doctor" on public.consultation_summaries;
create policy "consultation_summaries_select_doctor"
  on public.consultation_summaries for select to authenticated
  using (
    exists (
      select 1
      from public.doctors d
      where d.id = consultation_summaries.doctor_id
        and d.auth_user_id = auth.uid()
    )
  );

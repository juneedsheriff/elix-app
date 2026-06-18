-- Patients may detach their own records from a request before verification.

drop policy if exists "opinion_request_records_delete_own_unverified" on public.opinion_request_records;
create policy "opinion_request_records_delete_own_unverified"
  on public.opinion_request_records
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.opinion_requests o
      where o.id = opinion_request_records.request_id
        and o.patient_id = auth.uid()
        and o.records_verified_at is null
        and o.status <> 'closed'
    )
  );

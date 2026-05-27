-- Admin can approve patient opinion requests; doctors only see approved cases (in_review / closed)

drop policy if exists "opinion_requests_update_admins" on public.opinion_requests;
create policy "opinion_requests_update_admins"
  on public.opinion_requests
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "opinion_requests_select_doctor" on public.opinion_requests;
create policy "opinion_requests_select_doctor"
  on public.opinion_requests
  for select
  to authenticated
  using (
    opinion_requests.status in ('in_review', 'closed')
    and exists (
      select 1
      from public.doctors d
      where d.id = opinion_requests.doctor_id
        and d.auth_user_id = auth.uid()
    )
  );

drop policy if exists "uploaded_files_select_doctor_request" on public.uploaded_files;
create policy "uploaded_files_select_doctor_request"
  on public.uploaded_files
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.opinion_request_records orr
      join public.opinion_requests oreq on oreq.id = orr.request_id
      join public.doctors d on d.id = oreq.doctor_id
      where orr.record_id = uploaded_files.id
        and oreq.status in ('in_review', 'closed')
        and d.auth_user_id = auth.uid()
    )
  );

drop policy if exists "medical_records_storage_select_doctor" on storage.objects;
create policy "medical_records_storage_select_doctor"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'medical-records'
    and exists (
      select 1
      from public.uploaded_files uf
      join public.opinion_request_records orr on orr.record_id = uf.id
      join public.opinion_requests oreq on oreq.id = orr.request_id
      join public.doctors d on d.id = oreq.doctor_id
      where uf.storage_path = name
        and oreq.status in ('in_review', 'closed')
        and d.auth_user_id = auth.uid()
    )
  );

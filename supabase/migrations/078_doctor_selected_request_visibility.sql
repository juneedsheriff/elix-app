-- Ensure doctors can access requests assigned via selected_doctor_id
-- (patient/PSE selection flow) in addition to legacy doctor_id assignment.

drop policy if exists "opinion_requests_select_doctor" on public.opinion_requests;
create policy "opinion_requests_select_doctor"
  on public.opinion_requests
  for select
  to authenticated
  using (
    public.current_doctor_id() is not null
    and (
      opinion_requests.doctor_id = public.current_doctor_id()
      or opinion_requests.selected_doctor_id = public.current_doctor_id()
      or exists (
        select 1
        from public.opinion_request_recommendations rec
        where rec.request_id = opinion_requests.id
          and rec.doctor_id = public.current_doctor_id()
      )
    )
  );

drop policy if exists "opinion_requests_update_doctor" on public.opinion_requests;
create policy "opinion_requests_update_doctor"
  on public.opinion_requests
  for update
  to authenticated
  using (
    public.current_doctor_id() is not null
    and (
      opinion_requests.doctor_id = public.current_doctor_id()
      or opinion_requests.selected_doctor_id = public.current_doctor_id()
    )
  )
  with check (
    public.current_doctor_id() is not null
    and (
      opinion_requests.doctor_id = public.current_doctor_id()
      or opinion_requests.selected_doctor_id = public.current_doctor_id()
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
      from public.opinion_requests oreq
      where oreq.id = uploaded_files.request_id
        and (
          oreq.doctor_id = public.current_doctor_id()
          or oreq.selected_doctor_id = public.current_doctor_id()
        )
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
      from public.medical_records mr
      join public.opinion_request_records orr on orr.record_id = mr.id
      join public.opinion_requests oreq on oreq.id = orr.request_id
      where mr.storage_path = name
        and (
          oreq.doctor_id = public.current_doctor_id()
          or oreq.selected_doctor_id = public.current_doctor_id()
        )
    )
  );

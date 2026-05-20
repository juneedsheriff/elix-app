-- Run this entire file once in Supabase Dashboard → SQL Editor
-- Fixes: doctor can read requests (006) + doctor can respond to patients (009)

-- 006: doctor read access
drop policy if exists "opinion_requests_select_doctor" on public.opinion_requests;
create policy "opinion_requests_select_doctor"
  on public.opinion_requests for select to authenticated
  using (
    exists (
      select 1 from public.doctors d
      where d.id = opinion_requests.doctor_id and d.auth_user_id = auth.uid()
    )
  );

drop policy if exists "uploaded_files_select_doctor_request" on public.uploaded_files;
create policy "uploaded_files_select_doctor_request"
  on public.uploaded_files for select to authenticated
  using (
    exists (
      select 1 from public.opinion_request_records orr
      join public.opinion_requests oreq on oreq.id = orr.request_id
      join public.doctors d on d.id = oreq.doctor_id
      where orr.record_id = uploaded_files.id and d.auth_user_id = auth.uid()
    )
  );

drop policy if exists "medical_records_storage_select_doctor" on storage.objects;
create policy "medical_records_storage_select_doctor"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'medical-records'
    and exists (
      select 1 from public.uploaded_files uf
      join public.opinion_request_records orr on orr.record_id = uf.id
      join public.opinion_requests oreq on oreq.id = orr.request_id
      join public.doctors d on d.id = oreq.doctor_id
      where uf.storage_path = name and d.auth_user_id = auth.uid()
    )
  );

-- 007: names (safe if already applied)
alter table public.opinion_requests
  add column if not exists patient_name text,
  add column if not exists doctor_name text;

-- 009: doctor response columns
alter table public.opinion_requests
  add column if not exists doctor_response text,
  add column if not exists responded_at timestamptz;

drop policy if exists "opinion_requests_update_doctor" on public.opinion_requests;
create policy "opinion_requests_update_doctor"
  on public.opinion_requests for update to authenticated
  using (
    exists (
      select 1 from public.doctors d
      where d.id = opinion_requests.doctor_id and d.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.doctors d
      where d.id = opinion_requests.doctor_id and d.auth_user_id = auth.uid()
    )
  );

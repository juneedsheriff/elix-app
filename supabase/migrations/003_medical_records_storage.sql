-- Storage for uploaded medical records (PDF, JPG, DOC)

alter table public.medical_records
  add column if not exists storage_path text;

create index if not exists medical_records_storage_path_idx on public.medical_records (storage_path)
  where storage_path is not null;

drop policy if exists "medical_records_insert_own" on public.medical_records;

drop policy if exists "medical_records_insert" on public.medical_records;
create policy "medical_records_insert"
  on public.medical_records
  for insert
  to authenticated
  with check (patient_id = auth.uid());

drop policy if exists "medical_records_delete_own" on public.medical_records;
create policy "medical_records_delete_own"
  on public.medical_records
  for delete
  to authenticated
  using (patient_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'medical-records',
  'medical-records',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "medical_records_storage_insert" on storage.objects;
create policy "medical_records_storage_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'medical-records'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

drop policy if exists "medical_records_storage_select" on storage.objects;
create policy "medical_records_storage_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'medical-records'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

drop policy if exists "medical_records_storage_delete" on storage.objects;
create policy "medical_records_storage_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'medical-records'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

-- Canonical table for patient file uploads (metadata + Supabase Storage path)

create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  file_size_bytes bigint not null default 0 check (file_size_bytes >= 0),
  storage_bucket text not null default 'medical-records',
  storage_path text not null,
  summary text,
  uploaded_at timestamptz not null default now()
);

create unique index if not exists uploaded_files_storage_path_idx on public.uploaded_files (storage_path);
create index if not exists uploaded_files_user_idx on public.uploaded_files (user_id);
create index if not exists uploaded_files_uploaded_at_idx on public.uploaded_files (uploaded_at desc);

comment on table public.uploaded_files is 'Metadata for files stored in Supabase Storage (bucket medical-records)';

-- Copy existing rows from medical_records when upgrading
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'medical_records'
  ) then
    insert into public.uploaded_files (
      id, user_id, file_name, mime_type, file_size_bytes, storage_bucket, storage_path, summary, uploaded_at
    )
    select
      id,
      patient_id,
      file_name,
      coalesce(file_type, 'application/octet-stream'),
      0,
      'medical-records',
      coalesce(storage_path, id::text || '/' || file_name),
      summary,
      uploaded_at
    from public.medical_records
    on conflict (id) do nothing;
  end if;
end $$;

-- Point opinion_request_records at uploaded_files
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'opinion_request_records'
  ) then
    alter table public.opinion_request_records
      drop constraint if exists opinion_request_records_record_id_fkey;

    alter table public.opinion_request_records
      add constraint opinion_request_records_record_id_fkey
      foreign key (record_id) references public.uploaded_files (id) on delete cascade;
  end if;
exception
  when others then
    raise notice 'opinion_request_records FK update skipped: %', sqlerrm;
end $$;

alter table public.uploaded_files enable row level security;

drop policy if exists "uploaded_files_select" on public.uploaded_files;
create policy "uploaded_files_select"
  on public.uploaded_files
  for select
  to anon, authenticated
  using (user_id is null or user_id = auth.uid());

drop policy if exists "uploaded_files_insert" on public.uploaded_files;
create policy "uploaded_files_insert"
  on public.uploaded_files
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "uploaded_files_delete" on public.uploaded_files;
create policy "uploaded_files_delete"
  on public.uploaded_files
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "uploaded_files_update" on public.uploaded_files;
create policy "uploaded_files_update"
  on public.uploaded_files
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Storage bucket (same as medical records vault)
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
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "medical_records_storage_insert" on storage.objects;
create policy "medical_records_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'medical-records'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

drop policy if exists "medical_records_storage_select" on storage.objects;
create policy "medical_records_storage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'medical-records'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

drop policy if exists "medical_records_storage_delete" on storage.objects;
create policy "medical_records_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'medical-records'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

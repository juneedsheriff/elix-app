-- Medical record category and external links (e.g. DICOM via Google Drive).

alter table public.uploaded_files
  add column if not exists record_category text,
  add column if not exists external_url text;

comment on column public.uploaded_files.record_category is
  'Patient-selected document type: doctors_notes, lab_results, dicom_file, etc.';
comment on column public.uploaded_files.external_url is
  'Optional external share URL when file is too large to store (e.g. Google Drive DICOM).';

-- External-link rows use a synthetic storage_path; allow null for legacy compatibility.
alter table public.uploaded_files alter column storage_path drop not null;

-- Replace strict unique index with partial unique (R2 paths only).
drop index if exists public.uploaded_files_storage_path_idx;
create unique index if not exists uploaded_files_storage_path_idx
  on public.uploaded_files (storage_path)
  where storage_path is not null and external_url is null;

create index if not exists uploaded_files_record_category_idx
  on public.uploaded_files (record_category)
  where record_category is not null;

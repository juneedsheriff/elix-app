-- Store generated consultation summary PDF in R2 (path set by app after doctor submits).

alter table public.consultation_summaries
  add column if not exists pdf_storage_path text;

comment on column public.consultation_summaries.pdf_storage_path is
  'R2 object key for the generated consultation summary PDF.';

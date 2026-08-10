-- Store optional file attachments for prescription images and lab order files
-- alongside typed consultation notes.

alter table public.consultation_summaries
  add column if not exists prescription_file_path text,
  add column if not exists prescription_file_name text,
  add column if not exists lab_order_file_path text,
  add column if not exists lab_order_file_name text;

comment on column public.consultation_summaries.prescription_file_path is
  'R2/storage path for doctor-uploaded prescription image.';
comment on column public.consultation_summaries.prescription_file_name is
  'Original file name for prescription image.';
comment on column public.consultation_summaries.lab_order_file_path is
  'R2/storage path for doctor-uploaded lab order file.';
comment on column public.consultation_summaries.lab_order_file_name is
  'Original file name for lab order file.';

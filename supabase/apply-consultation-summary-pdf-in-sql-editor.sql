-- Run in Supabase SQL Editor if migration 027 is not applied via CLI.

alter table public.consultation_summaries
  add column if not exists pdf_storage_path text;

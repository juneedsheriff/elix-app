-- Paste into Supabase SQL Editor if npm run db:apply-payment-proof is unavailable

alter table public.opinion_requests
  add column if not exists payment_proof_storage_path text,
  add column if not exists payment_proof_file_name text,
  add column if not exists payment_proof_mime_type text,
  add column if not exists payment_proof_submitted_at timestamptz;

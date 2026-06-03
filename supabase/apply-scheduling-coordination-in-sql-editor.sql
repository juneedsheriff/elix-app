-- Run in Supabase SQL Editor if npm run db:apply-scheduling-coordination is unavailable.
-- Migration 023: scheduling coordination + payment link

alter table public.opinion_requests
  drop constraint if exists opinion_requests_consultation_stage_check;

alter table public.opinion_requests
  add constraint opinion_requests_consultation_stage_check
  check (
    consultation_stage in (
      'new',
      'assigned',
      'recommended',
      'doctor_selected',
      'availability_submitted',
      'schedule_proposed',
      'schedule_confirmed',
      'scheduled',
      'payment_pending',
      'paid',
      'completed'
    )
  );

alter table public.opinion_requests
  add column if not exists payment_link text,
  add column if not exists pse_scheduling_message text,
  add column if not exists schedule_confirmed_at timestamptz;

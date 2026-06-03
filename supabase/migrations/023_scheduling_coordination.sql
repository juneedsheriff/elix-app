-- Scheduling coordination: PSE reviews patient doctor choice, proposes slots, payment link

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

comment on column public.opinion_requests.payment_link is 'Payment URL sent by PSE after schedule is confirmed';
comment on column public.opinion_requests.pse_scheduling_message is 'PSE message: confirmed time or alternative slots for patient';

-- Backfill activity history for existing opinion requests (one-time, idempotent)

-- 1. Request submitted
insert into public.opinion_request_audit_events (
  request_id, actor_user_id, actor_role, actor_name, action, summary, metadata, created_at
)
select
  r.id,
  r.patient_id,
  'patient',
  r.patient_name,
  case
    when coalesce(r.doctor_selection_mode, '') = 'needs_recommendation' then 'recommendation_request_created'
    else 'request_created'
  end,
  case
    when coalesce(r.doctor_selection_mode, '') = 'needs_recommendation' then 'Recommendation request submitted'
    else 'Second opinion request submitted'
  end,
  jsonb_build_object('backfill', true),
  r.created_at
from public.opinion_requests r
where not exists (
  select 1
  from public.opinion_request_audit_events e
  where e.request_id = r.id
    and e.action in ('request_created', 'recommendation_request_created')
);

-- 2. Assigned to care team
insert into public.opinion_request_audit_events (
  request_id, actor_user_id, actor_role, actor_name, action, summary, metadata, created_at
)
select
  r.id,
  null,
  'administrator',
  coalesce(
    (select a.full_name from public.admins a where a.id = r.assigned_to limit 1),
    'Administrator'
  ),
  'request_assigned',
  'Request assigned to care team member',
  jsonb_build_object(
    'backfill', true,
    'assigned_to', r.assigned_to,
    'assigned_to_name', (select a.full_name from public.admins a where a.id = r.assigned_to limit 1)
  ),
  r.assigned_at
from public.opinion_requests r
where r.assigned_at is not null
  and not exists (
    select 1
    from public.opinion_request_audit_events e
    where e.request_id = r.id and e.action = 'request_assigned'
  );

-- 3. Records verified
insert into public.opinion_request_audit_events (
  request_id, actor_user_id, actor_role, actor_name, action, summary, metadata, created_at
)
select
  r.id,
  null,
  'pse',
  'Patient service',
  'records_verified',
  'Medical records verified',
  jsonb_build_object('backfill', true),
  r.records_verified_at
from public.opinion_requests r
where r.records_verified_at is not null
  and not exists (
    select 1
    from public.opinion_request_audit_events e
    where e.request_id = r.id and e.action = 'records_verified'
  );

-- 4. Recommendations shared (when recommendation rows exist)
insert into public.opinion_request_audit_events (
  request_id, actor_user_id, actor_role, actor_name, action, summary, metadata, created_at
)
select
  r.id,
  null,
  'pse',
  'Patient service',
  'recommendations_shared',
  'Doctor recommendations shared with patient',
  jsonb_build_object(
    'backfill', true,
    'recommendation_count', (
      select count(*)::int
      from public.opinion_request_recommendations rec
      where rec.request_id = r.id
    )
  ),
  coalesce(
    (select min(rec.created_at) from public.opinion_request_recommendations rec where rec.request_id = r.id),
    r.records_verified_at,
    r.assigned_at,
    r.created_at
  )
from public.opinion_requests r
where exists (
  select 1 from public.opinion_request_recommendations rec where rec.request_id = r.id
)
and not exists (
  select 1
  from public.opinion_request_audit_events e
  where e.request_id = r.id and e.action = 'recommendations_shared'
);

-- 5. Doctor selected
insert into public.opinion_request_audit_events (
  request_id, actor_user_id, actor_role, actor_name, action, summary, metadata, created_at
)
select
  r.id,
  r.patient_id,
  'patient',
  r.patient_name,
  'doctor_selected',
  'Doctor selected',
  jsonb_build_object(
    'backfill', true,
    'doctor_id', r.selected_doctor_id,
    'doctor_name', r.doctor_name
  ),
  coalesce(
    r.schedule_confirmed_at,
    r.payment_confirmed_at,
    r.records_verified_at,
    r.assigned_at,
    r.created_at
  ) - interval '2 hours'
from public.opinion_requests r
where r.selected_doctor_id is not null
  and coalesce(r.consultation_stage, 'new') not in ('new', 'assigned', 'recommended')
  and not exists (
    select 1
    from public.opinion_request_audit_events e
    where e.request_id = r.id and e.action = 'doctor_selected'
  );

-- 6. Availability submitted
insert into public.opinion_request_audit_events (
  request_id, actor_user_id, actor_role, actor_name, action, summary, metadata, created_at
)
select
  r.id,
  r.patient_id,
  'patient',
  r.patient_name,
  case
    when r.selected_doctor_id is not null then 'doctor_and_availability_submitted'
    else 'availability_submitted'
  end,
  case
    when r.selected_doctor_id is not null then 'Doctor and preferred time submitted'
    else 'Preferred appointment time submitted'
  end,
  jsonb_build_object('backfill', true),
  coalesce(
    r.schedule_confirmed_at,
    r.payment_confirmed_at,
    r.records_verified_at,
    r.created_at
  ) - interval '90 minutes'
from public.opinion_requests r
where r.patient_availability is not null
  and coalesce(r.consultation_stage, 'new') in (
    'availability_submitted',
    'schedule_proposed',
    'schedule_confirmed',
    'scheduled',
    'payment_pending',
    'paid',
    'completed'
  )
  and not exists (
    select 1
    from public.opinion_request_audit_events e
    where e.request_id = r.id
      and e.action in ('availability_submitted', 'doctor_and_availability_submitted')
  );

-- 7. Schedule confirmed
insert into public.opinion_request_audit_events (
  request_id, actor_user_id, actor_role, actor_name, action, summary, metadata, created_at
)
select
  r.id,
  r.patient_id,
  'patient',
  r.patient_name,
  'schedule_confirmed',
  'Appointment schedule confirmed',
  jsonb_build_object('backfill', true),
  r.schedule_confirmed_at
from public.opinion_requests r
where r.schedule_confirmed_at is not null
  and not exists (
    select 1
    from public.opinion_request_audit_events e
    where e.request_id = r.id and e.action = 'schedule_confirmed'
  );

-- 8. Payment proof uploaded
insert into public.opinion_request_audit_events (
  request_id, actor_user_id, actor_role, actor_name, action, summary, metadata, created_at
)
select
  r.id,
  r.patient_id,
  'patient',
  r.patient_name,
  'payment_proof_submitted',
  'Payment proof uploaded',
  jsonb_build_object(
    'backfill', true,
    'file_name', r.payment_proof_file_name
  ),
  r.payment_proof_submitted_at
from public.opinion_requests r
where r.payment_proof_submitted_at is not null
  and not exists (
    select 1
    from public.opinion_request_audit_events e
    where e.request_id = r.id and e.action = 'payment_proof_submitted'
  );

-- 9. Invoice + payment link (combined or separate)
insert into public.opinion_request_audit_events (
  request_id, actor_user_id, actor_role, actor_name, action, summary, metadata, created_at
)
select
  r.id,
  null,
  'pse',
  'Patient service',
  case
    when r.invoice_pdf_storage_path is not null and r.payment_link is not null then 'invoice_and_payment_sent'
    when r.invoice_pdf_storage_path is not null then 'invoice_generated'
    else 'payment_link_sent'
  end,
  case
    when r.invoice_pdf_storage_path is not null and r.payment_link is not null then 'Invoice generated and payment link sent'
    when r.invoice_pdf_storage_path is not null then 'Consultation invoice generated'
    else 'Payment link sent to patient'
  end,
  jsonb_build_object(
    'backfill', true,
    'invoice_number', r.invoice_number,
    'payment_amount', r.payment_amount,
    'payment_currency', r.payment_currency
  ),
  coalesce(
    r.invoice_generated_at,
    r.payment_confirmed_at,
    r.schedule_confirmed_at,
    r.created_at
  )
from public.opinion_requests r
where (r.invoice_pdf_storage_path is not null or r.payment_link is not null)
  and not exists (
    select 1
    from public.opinion_request_audit_events e
    where e.request_id = r.id
      and e.action in ('invoice_generated', 'payment_link_sent', 'invoice_and_payment_sent')
  );

-- 10. Payment confirmed
insert into public.opinion_request_audit_events (
  request_id, actor_user_id, actor_role, actor_name, action, summary, metadata, created_at
)
select
  r.id,
  null,
  'pse',
  'Patient service',
  'payment_confirmed',
  'Payment confirmed',
  jsonb_build_object(
    'backfill', true,
    'payment_amount', r.payment_amount,
    'payment_currency', r.payment_currency,
    'payment_reference', r.payment_reference
  ),
  r.payment_confirmed_at
from public.opinion_requests r
where r.payment_confirmed_at is not null
  and not exists (
    select 1
    from public.opinion_request_audit_events e
    where e.request_id = r.id and e.action = 'payment_confirmed'
  );

-- 11. Appointment scheduled
insert into public.opinion_request_audit_events (
  request_id, actor_user_id, actor_role, actor_name, action, summary, metadata, created_at
)
select
  r.id,
  null,
  'pse',
  'Patient service',
  'appointment_scheduled',
  'Appointment scheduled',
  jsonb_build_object(
    'backfill', true,
    'scheduled_at', r.scheduled_at,
    'meeting_link', r.meeting_link
  ),
  coalesce(r.scheduled_at, r.payment_confirmed_at, r.created_at)
from public.opinion_requests r
where r.scheduled_at is not null
  and not exists (
    select 1
    from public.opinion_request_audit_events e
    where e.request_id = r.id and e.action = 'appointment_scheduled'
  );

-- 12. Released to doctor
insert into public.opinion_request_audit_events (
  request_id, actor_user_id, actor_role, actor_name, action, summary, metadata, created_at
)
select
  r.id,
  null,
  'pse',
  'Patient service',
  'released_to_doctor',
  'Case released to doctor',
  jsonb_build_object('backfill', true),
  coalesce(r.responded_at, r.payment_confirmed_at, r.assigned_at, r.created_at)
from public.opinion_requests r
where r.status = 'in_review'
  and not exists (
    select 1
    from public.opinion_request_audit_events e
    where e.request_id = r.id and e.action = 'released_to_doctor'
  );

-- 13. Doctor consultation summary or opinion
insert into public.opinion_request_audit_events (
  request_id, actor_user_id, actor_role, actor_name, action, summary, metadata, created_at
)
select
  r.id,
  (select d.auth_user_id from public.doctors d where d.id = r.doctor_id limit 1),
  'doctor',
  coalesce(r.doctor_name, 'Doctor'),
  case
    when exists (select 1 from public.consultation_summaries cs where cs.request_id = r.id) then 'consultation_summary_saved'
    else 'doctor_opinion_submitted'
  end,
  case
    when exists (select 1 from public.consultation_summaries cs where cs.request_id = r.id) then 'Consultation summary saved'
    else 'Doctor opinion submitted'
  end,
  jsonb_build_object('backfill', true),
  coalesce(
    r.responded_at,
    (select cs.updated_at from public.consultation_summaries cs where cs.request_id = r.id limit 1),
    r.created_at
  )
from public.opinion_requests r
where (
    (r.doctor_response is not null and btrim(r.doctor_response) <> '')
    or exists (select 1 from public.consultation_summaries cs where cs.request_id = r.id)
  )
  and not exists (
    select 1
    from public.opinion_request_audit_events e
    where e.request_id = r.id
      and e.action in ('doctor_opinion_submitted', 'consultation_summary_saved')
  );

notify pgrst, 'reload schema';

-- Additional PSE activity backfill + staff names on existing audit rows

-- Attach assigned care-team member to generic PSE backfill rows
update public.opinion_request_audit_events e
set
  actor_user_id = a.auth_user_id,
  actor_name = a.full_name,
  actor_role = case
    when a.role = 'patient_service_executive' then 'pse'
    else 'administrator'
  end
from public.opinion_requests r
join public.admins a on a.id = r.assigned_to
where e.request_id = r.id
  and e.actor_role in ('pse', 'administrator')
  and (e.actor_name is null or e.actor_name in ('Patient service', 'Administrator'));

-- PSE curated doctor list (before sharing with patient)
insert into public.opinion_request_audit_events (
  request_id, actor_user_id, actor_role, actor_name, action, summary, metadata, created_at
)
select
  r.id,
  a.auth_user_id,
  case when a.role = 'patient_service_executive' then 'pse' else 'administrator' end,
  a.full_name,
  'doctors_recommended',
  'Doctors recommended to patient',
  jsonb_build_object(
    'backfill', true,
    'recommendation_count', (
      select count(*)::int from public.opinion_request_recommendations rec where rec.request_id = r.id
    )
  ),
  coalesce(
    (select min(rec.created_at) from public.opinion_request_recommendations rec where rec.request_id = r.id),
    r.created_at
  ) - interval '2 minutes'
from public.opinion_requests r
left join public.admins a on a.id = r.assigned_to
where exists (select 1 from public.opinion_request_recommendations rec where rec.request_id = r.id)
  and not exists (
    select 1 from public.opinion_request_audit_events e
    where e.request_id = r.id and e.action = 'doctors_recommended'
  );

-- PSE proposed a confirmed appointment slot
insert into public.opinion_request_audit_events (
  request_id, actor_user_id, actor_role, actor_name, action, summary, metadata, created_at
)
select
  r.id,
  a.auth_user_id,
  case when coalesce(a.role, 'patient_service_executive') = 'patient_service_executive' then 'pse' else 'administrator' end,
  coalesce(a.full_name, 'Patient service'),
  'schedule_proposed',
  'Appointment schedule proposed',
  jsonb_build_object('backfill', true, 'scheduled_at', r.scheduled_at),
  coalesce(r.schedule_confirmed_at, r.created_at) - interval '3 hours'
from public.opinion_requests r
left join public.admins a on a.id = r.assigned_to
where r.scheduled_at is not null
  and coalesce(r.pse_scheduling_message, '') <> ''
  and coalesce(r.consultation_stage, 'new') in (
    'schedule_proposed',
    'schedule_confirmed',
    'payment_pending',
    'paid',
    'scheduled',
    'completed'
  )
  and not exists (
    select 1 from public.opinion_request_audit_events e
    where e.request_id = r.id and e.action = 'schedule_proposed'
  );

-- PSE proposed alternative times
insert into public.opinion_request_audit_events (
  request_id, actor_user_id, actor_role, actor_name, action, summary, metadata, created_at
)
select
  r.id,
  a.auth_user_id,
  case when coalesce(a.role, 'patient_service_executive') = 'patient_service_executive' then 'pse' else 'administrator' end,
  coalesce(a.full_name, 'Patient service'),
  'schedule_alternatives_proposed',
  'Alternative appointment times proposed',
  jsonb_build_object('backfill', true),
  coalesce(r.schedule_confirmed_at, r.records_verified_at, r.created_at) - interval '4 hours'
from public.opinion_requests r
left join public.admins a on a.id = r.assigned_to
where coalesce(r.pse_scheduling_message, '') <> ''
  and coalesce(r.consultation_stage, 'new') = 'schedule_proposed'
  and not exists (
    select 1 from public.opinion_request_audit_events e
    where e.request_id = r.id and e.action = 'schedule_alternatives_proposed'
  );

-- PSE approved patient doctor selection (self-select flow)
insert into public.opinion_request_audit_events (
  request_id, actor_user_id, actor_role, actor_name, action, summary, metadata, created_at
)
select
  r.id,
  a.auth_user_id,
  case when coalesce(a.role, 'patient_service_executive') = 'patient_service_executive' then 'pse' else 'administrator' end,
  coalesce(a.full_name, 'Patient service'),
  'patient_selection_approved',
  'Patient doctor selection approved',
  jsonb_build_object('backfill', true),
  coalesce(r.schedule_confirmed_at, r.created_at) - interval '30 minutes'
from public.opinion_requests r
left join public.admins a on a.id = r.assigned_to
where r.schedule_confirmed_at is not null
  and coalesce(r.pse_scheduling_message, '') = ''
  and r.selected_doctor_id is not null
  and coalesce(r.consultation_stage, 'new') in (
    'schedule_confirmed',
    'payment_pending',
    'paid',
    'scheduled',
    'completed'
  )
  and not exists (
    select 1 from public.opinion_request_audit_events e
    where e.request_id = r.id and e.action = 'patient_selection_approved'
  );

-- PSE marked payment pending without a link yet
insert into public.opinion_request_audit_events (
  request_id, actor_user_id, actor_role, actor_name, action, summary, metadata, created_at
)
select
  r.id,
  a.auth_user_id,
  case when coalesce(a.role, 'patient_service_executive') = 'patient_service_executive' then 'pse' else 'administrator' end,
  coalesce(a.full_name, 'Patient service'),
  'payment_pending_set',
  'Marked as payment pending',
  jsonb_build_object('backfill', true),
  coalesce(r.payment_proof_submitted_at, r.schedule_confirmed_at, r.created_at)
from public.opinion_requests r
left join public.admins a on a.id = r.assigned_to
where r.payment_status = 'pending'
  and coalesce(r.consultation_stage, 'new') = 'payment_pending'
  and coalesce(r.payment_link, '') = ''
  and not exists (
    select 1 from public.opinion_request_audit_events e
    where e.request_id = r.id and e.action = 'payment_pending_set'
  );

-- PSE forwarded request to doctor
insert into public.opinion_request_audit_events (
  request_id, actor_user_id, actor_role, actor_name, action, summary, metadata, created_at
)
select
  r.id,
  a.auth_user_id,
  case when coalesce(a.role, 'patient_service_executive') = 'patient_service_executive' then 'pse' else 'administrator' end,
  coalesce(a.full_name, 'Patient service'),
  'request_forwarded_to_doctor',
  'Request forwarded to doctor',
  jsonb_build_object('backfill', true),
  coalesce(r.responded_at, r.payment_confirmed_at, r.assigned_at, r.created_at)
from public.opinion_requests r
left join public.admins a on a.id = r.assigned_to
where r.status in ('in_review', 'closed')
  and coalesce(r.doctor_response, '') <> ''
  and not exists (
    select 1 from public.opinion_request_audit_events e
    where e.request_id = r.id and e.action = 'request_forwarded_to_doctor'
  );

-- Split combined invoice/payment event when both artifacts exist
insert into public.opinion_request_audit_events (
  request_id, actor_user_id, actor_role, actor_name, action, summary, metadata, created_at
)
select
  r.id,
  a.auth_user_id,
  case when coalesce(a.role, 'patient_service_executive') = 'patient_service_executive' then 'pse' else 'administrator' end,
  coalesce(a.full_name, 'Patient service'),
  'invoice_generated',
  'Consultation invoice generated',
  jsonb_build_object('backfill', true, 'invoice_number', r.invoice_number),
  coalesce(r.invoice_generated_at, r.created_at) - interval '5 minutes'
from public.opinion_requests r
left join public.admins a on a.id = r.assigned_to
where r.invoice_pdf_storage_path is not null
  and r.payment_link is not null
  and exists (
    select 1 from public.opinion_request_audit_events e
    where e.request_id = r.id and e.action = 'invoice_and_payment_sent'
  )
  and not exists (
    select 1 from public.opinion_request_audit_events e
    where e.request_id = r.id and e.action = 'invoice_generated'
  );

insert into public.opinion_request_audit_events (
  request_id, actor_user_id, actor_role, actor_name, action, summary, metadata, created_at
)
select
  r.id,
  a.auth_user_id,
  case when coalesce(a.role, 'patient_service_executive') = 'patient_service_executive' then 'pse' else 'administrator' end,
  coalesce(a.full_name, 'Patient service'),
  'payment_link_sent',
  'Payment link sent to patient',
  jsonb_build_object(
    'backfill', true,
    'payment_amount', r.payment_amount,
    'payment_currency', r.payment_currency
  ),
  coalesce(r.invoice_generated_at, r.schedule_confirmed_at, r.created_at)
from public.opinion_requests r
left join public.admins a on a.id = r.assigned_to
where r.payment_link is not null
  and r.invoice_pdf_storage_path is not null
  and exists (
    select 1 from public.opinion_request_audit_events e
    where e.request_id = r.id and e.action = 'invoice_and_payment_sent'
  )
  and not exists (
    select 1 from public.opinion_request_audit_events e
    where e.request_id = r.id and e.action = 'payment_link_sent'
  );

notify pgrst, 'reload schema';

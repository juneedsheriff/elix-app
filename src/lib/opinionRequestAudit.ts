import { supabase } from './supabase';

export type OpinionRequestAuditActorRole = 'patient' | 'pse' | 'administrator' | 'doctor' | 'system';

export type OpinionRequestAuditAction =
  | 'request_created'
  | 'recommendation_request_created'
  | 'request_assigned'
  | 'request_forwarded_to_doctor'
  | 'request_deleted'
  | 'records_verified'
  | 'case_details_reviewed'
  | 'case_details_updated'
  | 'records_rejected'
  | 'patient_records_attached'
  | 'pse_records_attached'
  | 'patient_record_detached'
  | 'pse_record_deleted'
  | 'patient_proceeded_without_records'
  | 'pse_proceeded_without_records'
  | 'doctors_recommended'
  | 'recommendations_shared'
  | 'doctor_selected'
  | 'doctor_and_availability_submitted'
  | 'availability_submitted'
  | 'schedule_proposed'
  | 'schedule_alternatives_proposed'
  | 'patient_selection_approved'
  | 'doctor_assigned_by_pse'
  | 'schedule_confirmed'
  | 'payment_proof_submitted'
  | 'invoice_generated'
  | 'payment_link_sent'
  | 'invoice_and_payment_sent'
  | 'appointment_scheduled'
  | 'payment_pending_set'
  | 'payment_confirmed'
  | 'released_to_doctor'
  | 'doctor_opinion_submitted'
  | 'consultation_summary_saved';

export const OPINION_REQUEST_AUDIT_ACTION_LABELS: Record<OpinionRequestAuditAction, string> = {
  request_created: 'Patient submitted a second opinion request',
  recommendation_request_created: 'Patient submitted a doctor recommendation request',
  request_assigned: 'Request assigned to care team member',
  request_forwarded_to_doctor: 'Request forwarded to doctor',
  request_deleted: 'Request deleted',
  records_verified: 'PSE verified patient medical records',
  case_details_reviewed: 'PSE reviewed patient case details',
  case_details_updated: 'Patient case details updated',
  records_rejected: 'PSE rejected medical records — patient notified',
  patient_records_attached: 'Patient attached medical records',
  pse_records_attached: 'PSE uploaded medical records on behalf of patient',
  patient_record_detached: 'Patient removed a medical record from the request',
  pse_record_deleted: 'PSE deleted a medical record from the request',
  patient_proceeded_without_records: 'Patient chose to proceed without medical records',
  pse_proceeded_without_records: 'PSE proceeded without attached medical records',
  doctors_recommended: 'PSE recommended doctors to patient',
  recommendations_shared: 'PSE shared doctor recommendations with patient',
  doctor_selected: 'Patient selected a doctor',
  doctor_and_availability_submitted: 'Patient submitted doctor choice and preferred time',
  availability_submitted: 'Patient submitted preferred appointment time',
  schedule_proposed: 'PSE proposed an appointment schedule',
  schedule_alternatives_proposed: 'PSE proposed alternative appointment times',
  patient_selection_approved: 'PSE approved patient doctor selection',
  doctor_assigned_by_pse: 'PSE assigned doctor without patient selection',
  schedule_confirmed: 'Patient confirmed the appointment schedule',
  payment_proof_submitted: 'Patient uploaded payment proof',
  invoice_generated: 'PSE generated consultation invoice',
  payment_link_sent: 'PSE sent payment link to patient',
  invoice_and_payment_sent: 'PSE sent consultation invoice and payment link',
  appointment_scheduled: 'PSE scheduled the appointment',
  payment_pending_set: 'PSE marked payment as pending',
  payment_confirmed: 'PSE confirmed payment received',
  released_to_doctor: 'PSE released case to doctor',
  doctor_opinion_submitted: 'Doctor submitted opinion',
  consultation_summary_saved: 'Doctor saved consultation summary'
};

export type OpinionRequestAuditAudience = 'patient' | 'staff';

export type OpinionRequestAuditEvent = {
  id: string;
  request_id: string;
  actor_user_id: string | null;
  actor_role: OpinionRequestAuditActorRole;
  actor_name: string | null;
  action: OpinionRequestAuditAction;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export function formatOpinionRequestAuditActorRole(
  role: OpinionRequestAuditActorRole,
  audience: OpinionRequestAuditAudience = 'staff'
): string {
  if (audience === 'patient') {
    switch (role) {
      case 'patient':
        return 'You';
      case 'pse':
        return 'PSE';
      case 'doctor':
        return 'Your doctor';
      case 'administrator':
        return 'Administrator';
      default:
        return 'System';
    }
  }

  switch (role) {
    case 'patient':
      return 'Patient';
    case 'pse':
      return 'PSE / Patient service';
    case 'administrator':
      return 'Administrator';
    case 'doctor':
      return 'Doctor';
    default:
      return 'System';
  }
}

function patientAuditSummary(
  action: OpinionRequestAuditAction,
  actorRole: OpinionRequestAuditActorRole
): string | null {
  switch (action) {
    case 'request_created':
      return actorRole === 'pse'
        ? 'PSE created this request for you'
        : 'You submitted a second opinion request';
    case 'recommendation_request_created':
      return 'You submitted a doctor recommendation request';
    case 'request_assigned':
      return 'PSE assigned your request';
    case 'request_forwarded_to_doctor':
      return 'Your request was forwarded to your doctor';
    case 'request_deleted':
      return 'This request was removed';
    case 'records_verified':
      return 'PSE verified your medical records';
    case 'case_details_reviewed':
      return 'PSE reviewed your case details';
    case 'case_details_updated':
      return actorRole === 'patient'
        ? 'You updated your case details'
        : 'PSE updated your case details';
    case 'records_rejected':
      return 'PSE asked you to re-upload your medical records';
    case 'patient_records_attached':
      return 'You attached medical records to this request';
    case 'pse_records_attached':
      return 'PSE uploaded medical records on your behalf';
    case 'patient_record_detached':
      return 'You removed a medical record from this request';
    case 'pse_record_deleted':
      return 'PSE removed a medical record from this request';
    case 'patient_proceeded_without_records':
      return 'You chose to proceed without medical records';
    case 'pse_proceeded_without_records':
      return 'PSE proceeded without attached medical records';
    case 'doctors_recommended':
      return 'PSE recommended doctors for you';
    case 'recommendations_shared':
      return 'Doctor recommendations were shared with you';
    case 'doctor_selected':
      return 'You selected a doctor';
    case 'doctor_and_availability_submitted':
      return 'You submitted your doctor choice and preferred time';
    case 'availability_submitted':
      return 'You submitted your preferred appointment time';
    case 'schedule_proposed':
      return 'PSE proposed an appointment time';
    case 'schedule_alternatives_proposed':
      return 'PSE proposed alternative appointment times';
    case 'patient_selection_approved':
      return 'PSE approved your doctor selection';
    case 'doctor_assigned_by_pse':
      return 'PSE assigned your consultation doctor';
    case 'schedule_confirmed':
      return 'You confirmed the appointment schedule';
    case 'payment_proof_submitted':
      return 'You uploaded payment proof';
    case 'invoice_generated':
      return 'PSE generated your consultation invoice';
    case 'payment_link_sent':
      return 'PSE sent you a payment link';
    case 'invoice_and_payment_sent':
      return 'PSE sent your invoice and payment link';
    case 'appointment_scheduled':
      return 'PSE scheduled your appointment';
    case 'payment_pending_set':
      return 'PSE marked payment as pending';
    case 'payment_confirmed':
      return 'PSE confirmed your payment';
    case 'released_to_doctor':
      return 'Your case was released to your doctor';
    case 'doctor_opinion_submitted':
      return 'Your doctor submitted their opinion';
    case 'consultation_summary_saved':
      return 'Your doctor saved your consultation summary';
    default:
      return null;
  }
}

function staffAuditSummary(
  action: OpinionRequestAuditAction,
  actorRole: OpinionRequestAuditActorRole
): string | null {
  switch (action) {
    case 'request_created':
      return actorRole === 'pse'
        ? 'PSE created request on behalf of patient'
        : 'Patient submitted a second opinion request';
    case 'recommendation_request_created':
      return 'Patient submitted a doctor recommendation request';
    case 'request_assigned':
      return 'Request assigned to care team member';
    case 'request_forwarded_to_doctor':
      return 'Request forwarded to doctor';
    case 'request_deleted':
      return 'Request deleted';
    case 'records_verified':
      return 'PSE verified patient medical records';
    case 'case_details_reviewed':
      return 'PSE reviewed patient case details';
    case 'case_details_updated':
      return actorRole === 'patient'
        ? 'Patient updated case details'
        : 'PSE updated patient case details';
    case 'records_rejected':
      return 'PSE rejected medical records — patient notified';
    case 'patient_records_attached':
      return 'Patient attached medical records';
    case 'pse_records_attached':
      return 'PSE uploaded medical records on behalf of patient';
    case 'patient_record_detached':
      return 'Patient removed a medical record from the request';
    case 'pse_record_deleted':
      return 'PSE deleted a medical record from the request';
    case 'patient_proceeded_without_records':
      return 'Patient chose to proceed without medical records';
    case 'pse_proceeded_without_records':
      return 'PSE proceeded without attached medical records';
    case 'doctors_recommended':
      return 'PSE recommended doctors to patient';
    case 'recommendations_shared':
      return 'PSE shared doctor recommendations with patient';
    case 'doctor_selected':
      return 'Patient selected a doctor';
    case 'doctor_and_availability_submitted':
      return 'Patient submitted doctor choice and preferred time';
    case 'availability_submitted':
      return 'Patient submitted preferred appointment time';
    case 'schedule_proposed':
      return 'PSE proposed an appointment schedule';
    case 'schedule_alternatives_proposed':
      return 'PSE proposed alternative appointment times';
    case 'patient_selection_approved':
      return 'PSE approved patient doctor selection';
    case 'doctor_assigned_by_pse':
      return 'PSE assigned doctor without patient selection';
    case 'schedule_confirmed':
      return 'Patient confirmed the appointment schedule';
    case 'payment_proof_submitted':
      return 'Patient uploaded payment proof';
    case 'invoice_generated':
      return 'PSE generated consultation invoice';
    case 'payment_link_sent':
      return 'PSE sent payment link to patient';
    case 'invoice_and_payment_sent':
      return 'PSE sent consultation invoice and payment link';
    case 'appointment_scheduled':
      return 'PSE scheduled the appointment';
    case 'payment_pending_set':
      return 'PSE marked payment as pending';
    case 'payment_confirmed':
      return 'PSE confirmed payment received';
    case 'released_to_doctor':
      return 'PSE released case to doctor';
    case 'doctor_opinion_submitted':
      return 'Doctor submitted opinion';
    case 'consultation_summary_saved':
      return 'Doctor saved consultation summary';
    default:
      return null;
  }
}

export function formatOpinionRequestAuditSummary(
  event: Pick<OpinionRequestAuditEvent, 'action' | 'actor_role' | 'summary'>,
  audience: OpinionRequestAuditAudience = 'staff'
): string {
  const formatted =
    audience === 'patient'
      ? patientAuditSummary(event.action, event.actor_role)
      : staffAuditSummary(event.action, event.actor_role);
  return formatted ?? event.summary?.trim() ?? OPINION_REQUEST_AUDIT_ACTION_LABELS[event.action];
}

export function formatOpinionRequestAuditActorLabel(
  event: Pick<OpinionRequestAuditEvent, 'actor_role' | 'actor_name'>,
  audience: OpinionRequestAuditAudience = 'staff'
): string {
  const roleLabel = formatOpinionRequestAuditActorRole(event.actor_role, audience);
  if (audience === 'patient' && event.actor_role === 'patient') {
    return roleLabel;
  }
  if (event.actor_name?.trim()) {
    return `${roleLabel} · ${event.actor_name.trim()}`;
  }
  return roleLabel;
}

function isMissingAuditTableError(error: { message?: string; code?: string } | null) {
  const msg = error?.message?.toLowerCase() ?? '';
  const code = error?.code ?? '';
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('opinion_request_audit_events') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table')
  );
}

async function resolveActorName(
  userId: string,
  role: OpinionRequestAuditActorRole
): Promise<string | null> {
  if (role === 'patient') {
    const { data } = await supabase
      .from('patients')
      .select('full_name')
      .eq('auth_user_id', userId)
      .maybeSingle();
    return data?.full_name?.trim() || null;
  }

  if (role === 'doctor') {
    const { data } = await supabase
      .from('doctors')
      .select('full_name')
      .eq('auth_user_id', userId)
      .maybeSingle();
    return data?.full_name?.trim() || null;
  }

  if (role === 'pse' || role === 'administrator') {
    const { data } = await supabase
      .from('admins')
      .select('full_name')
      .eq('auth_user_id', userId)
      .eq('is_active', true)
      .maybeSingle();
    return data?.full_name?.trim() || null;
  }

  return null;
}

async function resolveStaffAuditActor(
  hintRole: OpinionRequestAuditActorRole
): Promise<{
  actorUserId: string | null;
  actorRole: OpinionRequestAuditActorRole;
  actorName: string | null;
}> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { actorUserId: null, actorRole: hintRole, actorName: null };
  }

  const { data: admin } = await supabase
    .from('admins')
    .select('full_name, role')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (admin) {
    const staffRole: OpinionRequestAuditActorRole =
      admin.role === 'patient_service_executive' || admin.role === 'patient_service_executive_clinic'
        ? 'pse'
        : 'administrator';
    return {
      actorUserId: user.id,
      actorRole:
        hintRole === 'patient' || hintRole === 'doctor' || hintRole === 'system'
          ? hintRole
          : staffRole,
      actorName: admin.full_name?.trim() || null
    };
  }

  if (hintRole === 'patient' || hintRole === 'doctor') {
    const name = await resolveActorName(user.id, hintRole);
    return { actorUserId: user.id, actorRole: hintRole, actorName: name };
  }

  return {
    actorUserId: user.id,
    actorRole: hintRole,
    actorName: await resolveActorName(user.id, hintRole)
  };
}

async function resolveAuditActor(
  actorRole: OpinionRequestAuditActorRole,
  actorName?: string | null
): Promise<{
  actorUserId: string | null;
  actorRole: OpinionRequestAuditActorRole;
  actorName: string | null;
}> {
  if (actorRole === 'system') {
    return { actorUserId: null, actorRole: 'system', actorName: actorName?.trim() || 'System' };
  }

  if (actorRole === 'pse' || actorRole === 'administrator') {
    const staff = await resolveStaffAuditActor(actorRole);
    if (staff.actorName || staff.actorUserId) {
      return {
        ...staff,
        actorName: actorName?.trim() || staff.actorName
      };
    }
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { actorUserId: null, actorRole, actorName: actorName?.trim() || null };
  }

  const resolvedName = actorName?.trim() || (await resolveActorName(user.id, actorRole));
  return { actorUserId: user.id, actorRole, actorName: resolvedName };
}

export async function recordOpinionRequestAudit(
  requestId: string,
  action: OpinionRequestAuditAction,
  options?: {
    summary?: string;
    metadata?: Record<string, unknown>;
    actorRole?: OpinionRequestAuditActorRole;
    actorName?: string | null;
  }
): Promise<void> {
  const actorRole = options?.actorRole ?? 'system';
  const summary = options?.summary?.trim() || OPINION_REQUEST_AUDIT_ACTION_LABELS[action];

  try {
    const actor = await resolveAuditActor(actorRole, options?.actorName);
    const { error } = await supabase.from('opinion_request_audit_events').insert({
      request_id: requestId,
      actor_user_id: actor.actorUserId,
      actor_role: actor.actorRole,
      actor_name: actor.actorName,
      action,
      summary,
      metadata: options?.metadata ?? {}
    });

    if (error && !isMissingAuditTableError(error)) {
      console.warn('[opinionRequestAudit] insert failed:', error.message);
    }
  } catch (error) {
    console.warn('[opinionRequestAudit] unexpected error:', error);
  }
}

export async function fetchOpinionRequestAuditEvents(requestId: string): Promise<{
  data: OpinionRequestAuditEvent[] | null;
  error: { message: string } | null;
}> {
  const { data, error } = await supabase
    .from('opinion_request_audit_events')
    .select(
      'id, request_id, actor_user_id, actor_role, actor_name, action, summary, metadata, created_at'
    )
    .eq('request_id', requestId)
    .order('created_at', { ascending: false })
    .returns<OpinionRequestAuditEvent[]>();

  if (error) {
    if (isMissingAuditTableError(error)) {
      return {
        data: null,
        error: {
          message:
            'Activity history is not enabled yet. Run npm run db:apply-opinion-request-audit or apply supabase/migrations/038_opinion_request_audit.sql.'
        }
      };
    }
    return { data: null, error: { message: error.message } };
  }

  return {
    data: (data ?? []).map((row) => ({
      ...row,
      metadata: (row.metadata ?? {}) as Record<string, unknown>
    })),
    error: null
  };
}

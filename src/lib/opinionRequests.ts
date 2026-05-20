import type { OpinionRequest, OpinionRequestFile, OpinionRequestStatus } from '../types/opinionRequest';
import { fetchDoctorByAuthUserId, fetchDoctorById } from './doctors';
import { fetchPatientByAuthUserId } from './patients';
import { supabase } from './supabase';

const requestListSelectBase = `
  id,
  message,
  status,
  created_at,
  patient_id,
  patient_name,
  doctor_id,
  doctor_name,
  doctors (
    id,
    full_name,
    specialty
  ),
  opinion_request_records (
    uploaded_files (
      id,
      file_name,
      summary,
      storage_path
    )
  )
`;

/** Lightweight select for dashboards when nested joins fail */
const requestListSelectMinimal = `
  id,
  message,
  status,
  created_at,
  patient_id,
  patient_name,
  doctor_id,
  doctor_name,
  doctor_response,
  responded_at
`;

const requestListSelectMinimalBase = `
  id,
  message,
  status,
  created_at,
  patient_id,
  patient_name,
  doctor_id,
  doctor_name
`;

const requestListSelectWithResponse = `
  id,
  message,
  status,
  created_at,
  patient_id,
  patient_name,
  doctor_id,
  doctor_name,
  doctor_response,
  responded_at,
  doctors (
    id,
    full_name,
    specialty
  ),
  opinion_request_records (
    uploaded_files (
      id,
      file_name,
      summary,
      storage_path
    )
  )
`;

/** Patient-facing: waiting for a doctor opinion (no response text yet). */
export function isAwaitingDoctorReply(request: Pick<OpinionRequest, 'doctor_response'>): boolean {
  return !request.doctor_response?.trim();
}

function isMissingResponseColumnsError(error: { message?: string } | null) {
  const msg = error?.message?.toLowerCase() ?? '';
  return msg.includes('doctor_response') || msg.includes('responded_at');
}

type RequestListRow = {
  id: string;
  message: string;
  status: string;
  created_at: string;
  patient_id: string | null;
  patient_name: string | null;
  doctor_id: string;
  doctor_name: string | null;
  doctor_response: string | null;
  responded_at: string | null;
  doctors: { id: string; full_name: string; specialty: string } | null;
  opinion_request_records: Array<{
    uploaded_files: OpinionRequestFile | null;
  }> | null;
};

export type CreateOpinionRequestInput = {
  doctorId: string;
  message: string;
  recordIds: string[];
  patientId: string | null;
  patientName?: string | null;
  doctorName?: string | null;
};

/** Resolve doctors.id — never persist auth.users id in opinion_requests.doctor_id */
async function resolveDoctorRecord(doctorId: string) {
  const byId = await fetchDoctorById(doctorId);
  if (byId.data) return { doctor: byId.data, error: null };

  const byAuth = await fetchDoctorByAuthUserId(doctorId);
  if (byAuth.data) return { doctor: byAuth.data, error: null };

  return {
    doctor: null,
    error: { message: 'Doctor not found. doctor_id must match public.doctors.id.' }
  };
}

async function resolveNames(
  input: CreateOpinionRequestInput,
  doctor: { id: string; full_name: string }
) {
  let patientName = input.patientName?.trim() || null;
  let doctorName = input.doctorName?.trim() || doctor.full_name;

  if (!patientName && input.patientId) {
    const { data: patient } = await fetchPatientByAuthUserId(input.patientId);
    patientName = patient?.full_name ?? null;
  }

  return { patientName, doctorName };
}

export async function createOpinionRequest(input: CreateOpinionRequestInput) {
  const { doctor, error: doctorError } = await resolveDoctorRecord(input.doctorId);
  if (doctorError || !doctor) {
    return { data: null, error: doctorError ?? { message: 'Doctor not found.' } };
  }

  const { patientName, doctorName } = await resolveNames(input, doctor);

  const { data: request, error: requestError } = await supabase
    .from('opinion_requests')
    .insert({
      doctor_id: doctor.id,
      doctor_name: doctorName,
      message: input.message.trim(),
      patient_id: input.patientId,
      patient_name: patientName,
      status: 'submitted'
    })
    .select('id')
    .single();

  if (requestError || !request) {
    return { data: null, error: requestError };
  }

  if (input.recordIds.length > 0) {
    const links = input.recordIds.map((recordId) => ({
      request_id: request.id,
      record_id: recordId
    }));

    const { error: linkError } = await supabase.from('opinion_request_records').insert(links);

    if (linkError) {
      return { data: null, error: linkError };
    }
  }

  return { data: { id: request.id }, error: null };
}

function mapRequestRow(
  row: RequestListRow,
  patientMap: Map<string, { full_name: string; email: string }>
): OpinionRequest {
  const patient = row.patient_id ? patientMap.get(row.patient_id) : undefined;
  const records: OpinionRequestFile[] = [];

  for (const link of row.opinion_request_records ?? []) {
    const file = link.uploaded_files;
    if (file?.id) records.push(file);
  }

  return {
    id: row.id,
    message: row.message,
    status: row.status as OpinionRequestStatus,
    created_at: row.created_at,
    patient_id: row.patient_id,
    patient_name: row.patient_name ?? patient?.full_name ?? null,
    doctor_id: row.doctor_id,
    doctor_name: row.doctor_name ?? row.doctors?.full_name ?? null,
    doctor_specialty: row.doctors?.specialty ?? null,
    patient_email: patient?.email ?? null,
    doctor_response: row.doctor_response,
    responded_at: row.responded_at,
    records
  };
}

export async function submitDoctorOpinionResponse(requestId: string, responseText: string) {
  const trimmed = responseText.trim();
  if (!trimmed) {
    return { data: null, error: { message: 'Write your response before sending.' } };
  }

  const { data, error } = await supabase
    .from('opinion_requests')
    .update({
      doctor_response: trimmed,
      responded_at: new Date().toISOString(),
      status: 'closed'
    })
    .eq('id', requestId)
    .select('id, status, doctor_response, responded_at')
    .single();

  if (error) {
    const hint = isMissingResponseColumnsError(error)
      ? ' Run supabase/migrations/009_opinion_doctor_response.sql in the Supabase SQL Editor.'
      : '';
    return { data: null, error: { message: `${error.message}${hint}` } };
  }
  return { data, error: null };
}

async function loadPatientEmailMap(authUserIds: string[]) {
  const patientMap = new Map<string, { full_name: string; email: string }>();
  if (!authUserIds.length) return patientMap;

  const { data: patients, error: patientsError } = await supabase
    .from('patients')
    .select('auth_user_id, full_name, email')
    .in('auth_user_id', authUserIds);

  if (patientsError) throw patientsError;

  for (const p of patients ?? []) {
    if (p.auth_user_id) {
      patientMap.set(p.auth_user_id, { full_name: p.full_name, email: p.email });
    }
  }
  return patientMap;
}

type FetchOpinionRequestsResult = {
  data: OpinionRequest[] | null;
  error: { message: string } | null;
  /** False until migration 009_opinion_doctor_response.sql is applied */
  responsesEnabled: boolean;
};

async function fetchOpinionRequestRows(
  filter?: { column: 'patient_id' | 'doctor_id'; value: string }
): Promise<{ rows: RequestListRow[] | null; error: { message: string; code?: string } | null; responsesEnabled: boolean }> {
  const buildQuery = (select: string) => {
    let q = supabase.from('opinion_requests').select(select).order('created_at', { ascending: false });
    if (filter) q = q.eq(filter.column, filter.value);
    return q.returns<RequestListRow[]>();
  };

  let result = await buildQuery(requestListSelectWithResponse);
  if (!result.error) {
    return { rows: result.data, error: null, responsesEnabled: true };
  }

  if (isMissingResponseColumnsError(result.error)) {
    result = await buildQuery(requestListSelectBase);
    if (!result.error) {
      return { rows: result.data, error: null, responsesEnabled: false };
    }
  }

  if (result.error) {
    result = await buildQuery(requestListSelectMinimal);
    if (!result.error) {
      return { rows: result.data, error: null, responsesEnabled: true };
    }
    if (isMissingResponseColumnsError(result.error)) {
      result = await buildQuery(requestListSelectMinimalBase);
      if (!result.error) {
        return { rows: result.data, error: null, responsesEnabled: false };
      }
    }
  }

  return {
    rows: null,
    error: result.error ? { message: result.error.message, code: result.error.code } : { message: 'Unknown error' },
    responsesEnabled: false
  };
}

function permissionHint(code?: string, message?: string) {
  if (code === '42501' || message?.toLowerCase().includes('permission')) {
    return ' Run supabase/migrations/006_doctor_opinion_access.sql in the Supabase SQL Editor.';
  }
  return '';
}

export async function fetchPatientOpinionRequests(patientAuthUserId: string): Promise<FetchOpinionRequestsResult> {
  let { rows, error, responsesEnabled } = await fetchOpinionRequestRows({
    column: 'patient_id',
    value: patientAuthUserId
  });

  if (!error && (rows?.length ?? 0) === 0) {
    const fallback = await fetchOpinionRequestRows();
    if (!fallback.error && (fallback.rows?.length ?? 0) > 0) {
      rows = (fallback.rows ?? []).filter((row) => row.patient_id === patientAuthUserId);
      responsesEnabled = fallback.responsesEnabled;
    }
  }

  if (error) {
    return {
      data: null,
      error: { message: `${error.message}${permissionHint(error.code, error.message)}` },
      responsesEnabled: false
    };
  }

  return {
    data: (rows ?? []).map((row) => mapRequestRow(row, new Map())),
    error: null,
    responsesEnabled
  };
}

/** Loads requests visible to the signed-in doctor (RLS policy opinion_requests_select_doctor). */
export async function fetchDoctorOpinionRequests(): Promise<FetchOpinionRequestsResult> {
  const { rows, error, responsesEnabled } = await fetchOpinionRequestRows();

  if (error) {
    return {
      data: null,
      error: { message: `${error.message}${permissionHint(error.code, error.message)}` },
      responsesEnabled: false
    };
  }

  const authUserIds = [...new Set((rows ?? []).map((r) => r.patient_id).filter(Boolean))] as string[];

  try {
    const patientMap = await loadPatientEmailMap(authUserIds);
    return {
      data: (rows ?? []).map((row) => mapRequestRow(row, patientMap)),
      error: null,
      responsesEnabled
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load patient details';
    return { data: null, error: { message }, responsesEnabled: false };
  }
}

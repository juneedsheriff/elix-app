import type {
  ClinicDoctorRequest,
  DoctorWorkspaceLink,
  PlatformDoctorSearchResult
} from '../types/clinicDoctorRequest';
import type { Doctor } from '../types/doctor';
import { supabase } from './supabase';

export async function isDoctorAvailableToClinic(doctorId: string, clinicId: string) {
  const { data, error } = await supabase.rpc('is_doctor_in_clinic_workspace', {
    p_doctor_id: doctorId,
    p_clinic_id: clinicId
  });

  if (error) {
    const { data: doctor, error: doctorError } = await supabase
      .from('doctors')
      .select('clinic_id')
      .eq('id', doctorId)
      .maybeSingle();

    if (doctorError) {
      return { available: false, error: doctorError };
    }

    if (doctor?.clinic_id === clinicId) {
      return { available: true, error: null };
    }

    const { data: grant, error: grantError } = await supabase
      .from('clinic_doctor_grants')
      .select('doctor_id')
      .eq('clinic_id', clinicId)
      .eq('doctor_id', doctorId)
      .maybeSingle();

    if (grantError) {
      return { available: false, error: grantError };
    }

    return { available: Boolean(grant), error: null };
  }

  return { available: Boolean(data), error: null };
}

const REQUEST_COLUMNS =
  'id, clinic_id, doctor_id, requested_by, message, status, reviewed_by, reviewed_at, review_note, created_at, updated_at';

const MIGRATION_HINT =
  ' Run npm run db:apply-clinic-doctor-request-insert-fix (or db:apply-clinic-doctor-requests).';

function permissionHint(error: { code?: string; message?: string } | null) {
  if (!error) return '';
  const msg = (error.message ?? '').toLowerCase();
  if (error.code === '42501' || msg.includes('permission') || msg.includes('policy')) {
    return MIGRATION_HINT;
  }
  if (msg.includes('search_platform_doctors_for_clinic_pse') || msg.includes('clinic_doctor_requests')) {
    return MIGRATION_HINT;
  }
  return '';
}

type ClinicDoctorRequestRow = ClinicDoctorRequest & {
  doctor?: { full_name: string; specialty: string; email: string } | null;
  clinic?: { name: string } | null;
  requester?: { full_name: string } | null;
};

function mapRequestRow(row: ClinicDoctorRequestRow): ClinicDoctorRequest {
  return {
    id: row.id,
    clinic_id: row.clinic_id,
    doctor_id: row.doctor_id,
    requested_by: row.requested_by,
    message: row.message,
    status: row.status,
    reviewed_by: row.reviewed_by,
    reviewed_at: row.reviewed_at,
    review_note: row.review_note,
    created_at: row.created_at,
    updated_at: row.updated_at,
    doctor_name: row.doctor?.full_name ?? row.doctor_name ?? null,
    doctor_specialty: row.doctor?.specialty ?? row.doctor_specialty ?? null,
    doctor_email: row.doctor?.email ?? row.doctor_email ?? null,
    clinic_name: row.clinic?.name ?? row.clinic_name ?? null,
    requested_by_name: row.requester?.full_name ?? row.requested_by_name ?? null
  };
}

export async function searchPlatformDoctorsForClinicPse(query: string) {
  const { data, error } = await supabase.rpc('search_platform_doctors_for_clinic_pse', {
    p_query: query.trim()
  });

  if (error) {
    return {
      data: null,
      error: { message: `${error.message}${permissionHint(error)}` }
    };
  }

  return { data: (data ?? []) as PlatformDoctorSearchResult[], error: null };
}

export async function submitClinicDoctorRequest(input: {
  clinicId: string;
  doctorId: string;
  staffId: string;
  message?: string;
}) {
  const { data, error } = await supabase
    .from('clinic_doctor_requests')
    .insert({
      clinic_id: input.clinicId,
      doctor_id: input.doctorId,
      requested_by: input.staffId,
      message: input.message?.trim() || null,
      status: 'pending'
    })
    .select(REQUEST_COLUMNS)
    .single();

  if (error) {
    const message =
      error.code === '23505'
        ? 'A pending request for this doctor already exists.'
        : `${error.message}${permissionHint(error)}`;
    return { data: null, error: { message } };
  }

  return { data: mapRequestRow(data as ClinicDoctorRequestRow), error: null };
}

export async function fetchClinicDoctorRequestsForClinic() {
  const { data, error } = await supabase
    .from('clinic_doctor_requests')
    .select(`${REQUEST_COLUMNS}, doctor:doctors(full_name, specialty, email)`)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error: { message: `${error.message}${permissionHint(error)}` } };
  }

  return {
    data: (data ?? []).map((row) => mapRequestRow(row as ClinicDoctorRequestRow)),
    error: null
  };
}

export async function fetchPendingClinicDoctorRequestsForAdmin() {
  const { data, error } = await supabase
    .from('clinic_doctor_requests')
    .select(
      `${REQUEST_COLUMNS}, doctor:doctors(full_name, specialty, email), clinic:pse_clinics(name), requester:admins!clinic_doctor_requests_requested_by_fkey(full_name)`
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    return { data: null, error: { message: `${error.message}${permissionHint(error)}` } };
  }

  return {
    data: (data ?? []).map((row) => mapRequestRow(row as ClinicDoctorRequestRow)),
    error: null
  };
}

export async function fetchGrantedDoctorIdsForClinic(clinicId: string) {
  const { data, error } = await supabase
    .from('clinic_doctor_grants')
    .select('doctor_id')
    .eq('clinic_id', clinicId);

  if (error) {
    return { data: null, error: { message: `${error.message}${permissionHint(error)}` } };
  }

  return {
    data: (data ?? []).map((row) => row.doctor_id as string),
    error: null
  };
}

export async function approveClinicDoctorRequest(requestId: string) {
  const { error } = await supabase.rpc('approve_clinic_doctor_request', {
    p_request_id: requestId
  });

  if (error) {
    return { error: { message: `${error.message}${permissionHint(error)}` } };
  }

  return { error: null };
}

export async function rejectClinicDoctorRequest(requestId: string, reviewNote?: string) {
  const { error } = await supabase.rpc('reject_clinic_doctor_request', {
    p_request_id: requestId,
    p_review_note: reviewNote?.trim() || null
  });

  if (error) {
    return { error: { message: `${error.message}${permissionHint(error)}` } };
  }

  return { error: null };
}

export function clinicDoctorRequestStatusLabel(status: ClinicDoctorRequest['status']): string {
  if (status === 'pending') return 'Pending admin review';
  if (status === 'approved') return 'Approved';
  return 'Rejected';
}

type ClinicDoctorGrantRow = {
  doctor_id: string;
  clinic_id: string;
  pse_clinics?: { name: string } | { name: string }[] | null;
};

export async function fetchDoctorWorkspaceGrantsForAdmin() {
  const { data, error } = await supabase
    .from('clinic_doctor_grants')
    .select('doctor_id, clinic_id, pse_clinics(name)');

  if (error) {
    return { data: null, error: { message: `${error.message}${permissionHint(error)}` } };
  }

  const links = (data ?? []).map((row) => {
    const grant = row as ClinicDoctorGrantRow;
    const clinicRef = grant.pse_clinics;
    const clinicName = Array.isArray(clinicRef) ? clinicRef[0]?.name : clinicRef?.name;
    return {
      doctorId: grant.doctor_id,
      clinicId: grant.clinic_id,
      clinicName: clinicName?.trim() || 'Clinic workspace',
      linkType: 'granted' as const
    };
  });

  return { data: links, error: null };
}

export function buildDoctorWorkspaceLinksMap(
  doctors: Array<Pick<Doctor, 'id' | 'clinic_id' | 'pse_clinic_name'>>,
  grants: DoctorWorkspaceLink[]
) {
  const map = new Map<string, DoctorWorkspaceLink[]>();

  const pushLink = (doctorId: string, link: DoctorWorkspaceLink) => {
    const current = map.get(doctorId) ?? [];
    if (current.some((item) => item.clinicId === link.clinicId && item.linkType === link.linkType)) {
      return;
    }
    map.set(doctorId, [...current, link]);
  };

  for (const doctor of doctors) {
    if (!doctor.clinic_id) continue;
    pushLink(doctor.id, {
      doctorId: doctor.id,
      clinicId: doctor.clinic_id,
      clinicName: doctor.pse_clinic_name?.trim() || 'Clinic workspace',
      linkType: 'owned'
    });
  }

  for (const grant of grants) {
    pushLink(grant.doctorId, grant);
  }

  return map;
}

export async function removeDoctorFromClinicWorkspace(doctorId: string, clinicId: string) {
  const { data, error } = await supabase.rpc('remove_doctor_from_clinic_workspace', {
    p_doctor_id: doctorId,
    p_clinic_id: clinicId
  });

  if (error) {
    return { removedAs: null, error: { message: error.message } };
  }

  return { removedAs: (data as string) ?? 'grant', error: null };
}

export async function fetchPseClinicsForAdmin() {
  const { data, error } = await supabase.from('pse_clinics').select('id, name').order('name', { ascending: true });

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  return { data: data ?? [], error: null };
}

export async function fetchDoctorWorkspaceGrantsForDoctor(doctorId: string) {
  const { data, error } = await supabase
    .from('clinic_doctor_grants')
    .select('doctor_id, clinic_id, pse_clinics(name)')
    .eq('doctor_id', doctorId);

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  const links = (data ?? []).map((row) => {
    const grant = row as ClinicDoctorGrantRow;
    const clinicRef = grant.pse_clinics;
    const clinicName = Array.isArray(clinicRef) ? clinicRef[0]?.name : clinicRef?.name;
    return {
      doctorId: grant.doctor_id,
      clinicId: grant.clinic_id,
      clinicName: clinicName?.trim() || 'Clinic workspace',
      linkType: 'granted' as const
    };
  });

  return { data: links, error: null };
}

export async function grantDoctorToClinicForAdmin(doctorId: string, clinicId: string) {
  const { error } = await supabase.rpc('grant_doctor_to_clinic_workspace', {
    p_doctor_id: doctorId,
    p_clinic_id: clinicId
  });

  if (error) {
    return { error: { message: error.message } };
  }

  return { error: null };
}

function createDebouncedRefresh(onChange: () => void, debounceMs: number) {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleRefresh = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      onChange();
    }, debounceMs);
  };

  const cancel = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = null;
  };

  return { scheduleRefresh, cancel };
}

/** Realtime updates when admins grant/remove doctors from clinic workspaces. */
export function subscribeClinicDoctorsUpdates(
  onChange: () => void,
  options: { clinicId?: string | null; isAdmin?: boolean }
): () => void {
  const { scheduleRefresh, cancel } = createDebouncedRefresh(onChange, 400);
  const clinicId = options.clinicId?.trim() || null;
  const isAdmin = Boolean(options.isAdmin);

  if (!isAdmin && !clinicId) {
    return () => {};
  }

  const channelName = isAdmin
    ? 'elixhealth-doctors:admin'
    : `elixhealth-doctors:clinic:${clinicId}`;

  const channel = supabase.channel(channelName);

  if (isAdmin) {
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clinic_doctor_grants' }, () =>
        scheduleRefresh()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, () => scheduleRefresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clinic_doctor_requests' }, () =>
        scheduleRefresh()
      );
  } else if (clinicId) {
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clinic_doctor_grants',
          filter: `clinic_id=eq.${clinicId}`
        },
        () => scheduleRefresh()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'doctors',
          filter: `clinic_id=eq.${clinicId}`
        },
        () => scheduleRefresh()
      );
  }

  void channel.subscribe();

  return () => {
    cancel();
    void supabase.removeChannel(channel);
  };
}

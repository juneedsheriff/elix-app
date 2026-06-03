import {
  isAssignedToPatientService,
  isPendingAdminAssignment,
  staffRequestStatusLabel
} from '../../../lib/opinionRequests';
import type { OpinionRequest } from '../../../types/opinionRequest';

export type RequestQueueFilter = 'pending' | 'all';

export type RequestStatusFilter =
  | 'all'
  | 'pending_assignment'
  | 'with_patient_service'
  | 'with_doctor'
  | 'closed';

export type RequestQuickFilters = {
  queue: RequestQueueFilter;
  status: RequestStatusFilter;
  specialty: string | null;
  assignee: string | null;
};

/** PSE sees all assigned requests by default; admins start on the pending assignment queue. */
export function getDefaultRequestFilters(isAdmin: boolean): RequestQuickFilters {
  return {
    queue: isAdmin ? 'pending' : 'all',
    status: 'all',
    specialty: null,
    assignee: null
  };
}

export type RequestAnalytics = {
  total: number;
  pendingQueue: number;
  patientSelectionsToReview: number;
  withDoctor: number;
  closed: number;
};

export function patientInitials(name: string | null | undefined) {
  if (!name?.trim()) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatRequestDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date.toLocaleString();
}

export function requestStatusKey(
  request: Pick<OpinionRequest, 'status' | 'assigned_to' | 'doctor_response'>
): RequestStatusFilter {
  if (request.doctor_response?.trim() || request.status === 'closed') return 'closed';
  if (request.status === 'in_review') return 'with_doctor';
  if (request.status === 'submitted' && request.assigned_to) return 'with_patient_service';
  if (request.status === 'submitted') return 'pending_assignment';
  return 'all';
}

export function requestStatusColor(
  request: Pick<OpinionRequest, 'status' | 'assigned_to' | 'doctor_response'>
): 'orange' | 'cyan' | 'violet' | 'gray' | 'green' {
  const key = requestStatusKey(request);
  if (key === 'pending_assignment') return 'orange';
  if (key === 'with_patient_service') return 'cyan';
  if (key === 'with_doctor') return 'violet';
  if (key === 'closed') return 'gray';
  return 'green';
}

export function computeRequestAnalytics(
  requests: OpinionRequest[],
  isAdmin: boolean
): RequestAnalytics {
  const needsScheduleReview = (r: OpinionRequest) =>
    r.consultation_stage === 'availability_submitted' ||
    r.consultation_stage === 'schedule_proposed' ||
    r.consultation_stage === 'doctor_selected';

  return {
    total: requests.length,
    pendingQueue: isAdmin
      ? requests.filter(isPendingAdminAssignment).length
      : requests.filter(isAssignedToPatientService).length,
    patientSelectionsToReview: requests.filter(needsScheduleReview).length,
    withDoctor: requests.filter((r) => r.status === 'in_review').length,
    closed: requests.filter(
      (r) => r.status === 'closed' || Boolean(r.doctor_response?.trim())
    ).length
  };
}

export function uniqueSorted(values: (string | null | undefined)[]) {
  return [...new Set(values.map((v) => v?.trim()).filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b)
  );
}

export function applyRequestQuickFilters(
  requests: OpinionRequest[],
  filters: RequestQuickFilters,
  isAdmin: boolean
) {
  return requests.filter((request) => {
    if (filters.queue === 'pending') {
      if (isAdmin && !isPendingAdminAssignment(request)) return false;
      if (!isAdmin && !isAssignedToPatientService(request)) return false;
    }

    if (filters.status !== 'all' && requestStatusKey(request) !== filters.status) {
      return false;
    }

    if (filters.specialty && request.doctor_specialty !== filters.specialty) return false;
    if (filters.assignee && request.assigned_to_name !== filters.assignee) return false;

    return true;
  });
}

export function exportRequestsCsv(requests: OpinionRequest[]) {
  const headers = [
    'Patient',
    'Patient email',
    'Doctor',
    'Specialty',
    'Submitted',
    'Records',
    'Status',
    'Assigned to',
    'Message'
  ];

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

  const rows = requests.map((request) => {
    return [
      request.patient_name ?? '',
      request.patient_email ?? '',
      request.doctor_name ?? '',
      request.doctor_specialty ?? '',
      request.created_at ? new Date(request.created_at).toLocaleString() : '',
      String(request.records.length),
      staffRequestStatusLabel(request),
      request.assigned_to_name ?? '',
      request.message
    ]
      .map(escape)
      .join(',');
  });

  const csv = [headers.map(escape).join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `elix-opinion-requests-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

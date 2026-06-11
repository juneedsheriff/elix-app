import type { ElixHealthNavId } from '../../lib/staffPermissions';

export const ELIX_HEALTH_PATHS = {
  overview: '/elixhealth',
  doctors: '/elixhealth/doctors',
  doctorNew: '/elixhealth/doctor/new',
  doctor: '/elixhealth/doctor',
  patients: '/elixhealth/patients',
  patient: '/elixhealth/patient',
  staff: '/elixhealth/staff',
  requests: '/elixhealth/requests',
  workspace: '/elixhealth/workspace',
  workspaceCases: '/elixhealth/workspace/cases',
  workspaceConsultation: '/elixhealth/workspace/consultation',
  workspaceAvailability: '/elixhealth/workspace/availability'
} as const;

export type ElixHealthDoctorNavId = 'dashboard' | 'cases' | 'availability';

const DOCTOR_SCREEN_TO_PATH: Record<string, string> = {
  'doctor-dashboard': ELIX_HEALTH_PATHS.workspace,
  'case-review': ELIX_HEALTH_PATHS.workspaceCases,
  'doctor-consultation': ELIX_HEALTH_PATHS.workspaceConsultation,
  availability: ELIX_HEALTH_PATHS.workspaceAvailability
};

export function doctorWorkspacePath(screenId: string): string {
  return DOCTOR_SCREEN_TO_PATH[screenId] ?? ELIX_HEALTH_PATHS.workspace;
}

export function doctorNavIdFromPathname(pathname: string): ElixHealthDoctorNavId {
  if (pathname.startsWith(ELIX_HEALTH_PATHS.workspaceCases)) return 'cases';
  if (pathname.startsWith(ELIX_HEALTH_PATHS.workspaceAvailability)) return 'availability';
  return 'dashboard';
}

export function doctorPageTitleFromPathname(pathname: string): string {
  if (pathname.startsWith(ELIX_HEALTH_PATHS.workspaceConsultation)) return 'Consultation';
  if (pathname.startsWith(ELIX_HEALTH_PATHS.workspaceCases)) return 'Cases';
  if (pathname.startsWith(ELIX_HEALTH_PATHS.workspaceAvailability)) return 'Availability';
  return 'Dashboard';
}

export function doctorEditUrl(id: string, tab?: 'clinic' | 'scheduler' | 'login') {
  const params = new URLSearchParams({ id });
  if (tab) params.set('tab', tab);
  return `${ELIX_HEALTH_PATHS.doctor}?${params.toString()}`;
}

export function patientEditUrl(id: string) {
  return `${ELIX_HEALTH_PATHS.patient}?id=${encodeURIComponent(id)}`;
}

export function navIdFromPathname(pathname: string): ElixHealthNavId {
  if (pathname.startsWith('/elixhealth/doctor') || pathname === '/elixhealth/doctors') {
    return 'doctors';
  }
  if (pathname.startsWith('/elixhealth/patient') || pathname === '/elixhealth/patients') {
    return 'patients';
  }
  if (pathname === '/elixhealth/staff') return 'staff';
  if (pathname === '/elixhealth/requests') return 'requests';
  return 'overview';
}

export function pageTitleFromPathname(pathname: string, search: string): string {
  if (pathname === '/elixhealth/doctor/new') {
    return 'Add doctor';
  }
  if (pathname === '/elixhealth/doctor' && new URLSearchParams(search).get('id')) {
    const tab = new URLSearchParams(search).get('tab');
    if (tab === 'login') return 'Login access';
    if (tab === 'clinic') return 'Clinic details';
    if (tab === 'scheduler') return 'Scheduler';
    return 'Edit doctor';
  }
  if (pathname === '/elixhealth/patient' && new URLSearchParams(search).get('id')) {
    return 'Edit patient';
  }
  if (pathname === '/elixhealth/doctors') return 'Doctors';
  if (pathname === '/elixhealth/patients') return 'Patients';
  if (pathname === '/elixhealth/staff') return 'Staff';
  if (pathname === '/elixhealth/requests') return 'Opinion requests';
  return 'Dashboard';
}

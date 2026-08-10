import type { AdminRole } from '../../types/admin';
import {
  requestsNavLabel,
  staffLandingNavId,
  type ElixHealthNavId
} from '../../lib/staffPermissions';

export const ELIX_HEALTH_PATHS = {
  overview: '/elixhealth',
  doctors: '/elixhealth/doctors',
  doctorNew: '/elixhealth/doctor/new',
  doctor: '/elixhealth/doctor',
  patients: '/elixhealth/patients',
  patient: '/elixhealth/patient',
  staff: '/elixhealth/staff',
  profile: '/elixhealth/profile',
  requests: '/elixhealth/requests',
  workspace: '/elixhealth/workspace',
  workspaceCases: '/elixhealth/workspace/cases',
  workspaceConsultation: '/elixhealth/workspace/consultation',
  workspaceHomeCare: '/elixhealth/workspace/homecare',
  workspaceAvailability: '/elixhealth/workspace/availability',
  workspaceProfile: '/elixhealth/workspace/profile'
} as const;

const NAV_PATH: Record<ElixHealthNavId, string> = {
  overview: ELIX_HEALTH_PATHS.overview,
  doctors: ELIX_HEALTH_PATHS.doctors,
  patients: ELIX_HEALTH_PATHS.patients,
  requests: ELIX_HEALTH_PATHS.requests,
  staff: ELIX_HEALTH_PATHS.staff,
  profile: ELIX_HEALTH_PATHS.profile
};

/** Landing path for staff after login (clinic PSE → requests). */
export function staffLandingPath(role: AdminRole): string {
  return NAV_PATH[staffLandingNavId(role)];
}

export type ElixHealthDoctorNavId = 'dashboard' | 'profile';

const DOCTOR_SCREEN_TO_PATH: Record<string, string> = {
  'doctor-dashboard': ELIX_HEALTH_PATHS.workspace,
  'case-review': ELIX_HEALTH_PATHS.workspace,
  'doctor-consultation': ELIX_HEALTH_PATHS.workspaceConsultation,
  'doctor-homecare': ELIX_HEALTH_PATHS.workspaceHomeCare,
  availability: ELIX_HEALTH_PATHS.workspaceAvailability,
  settings: ELIX_HEALTH_PATHS.workspaceProfile,
  'doctor-profile': ELIX_HEALTH_PATHS.workspaceProfile
};

export function doctorWorkspacePath(screenId: string): string {
  return DOCTOR_SCREEN_TO_PATH[screenId] ?? ELIX_HEALTH_PATHS.workspace;
}

export function doctorNavIdFromPathname(pathname: string): ElixHealthDoctorNavId {
  if (pathname.startsWith(ELIX_HEALTH_PATHS.workspaceProfile)) return 'profile';
  return 'dashboard';
}

export function doctorPageTitleFromPathname(pathname: string): string {
  if (pathname.startsWith(ELIX_HEALTH_PATHS.workspaceConsultation)) return 'Consultation';
  if (pathname.startsWith(ELIX_HEALTH_PATHS.workspaceProfile)) return 'Profile';
  if (pathname.startsWith(ELIX_HEALTH_PATHS.workspaceHomeCare)) return 'Home Care';
  if (pathname.startsWith(ELIX_HEALTH_PATHS.workspaceAvailability)) return 'Scheduler';
  return 'Patient Requests';
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
  if (pathname === '/elixhealth/profile') return 'profile';
  if (pathname === '/elixhealth/requests') return 'requests';
  return 'overview';
}

export function pageTitleFromPathname(
  pathname: string,
  search: string,
  role?: AdminRole
): string {
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
  if (pathname === '/elixhealth/profile') return 'My profile';
  if (pathname === '/elixhealth/requests') {
    return role ? requestsNavLabel(role) : 'Requests';
  }
  return 'Dashboard';
}

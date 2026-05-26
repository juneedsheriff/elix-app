import type { ElixHealthNavId } from '../../lib/staffPermissions';

export const ELIX_HEALTH_PATHS = {
  overview: '/elixhealth',
  doctors: '/elixhealth/doctors',
  doctor: '/elixhealth/doctor',
  patients: '/elixhealth/patients',
  patient: '/elixhealth/patient',
  staff: '/elixhealth/staff',
  requests: '/elixhealth/requests'
} as const;

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

export type DashboardRole = 'patient' | 'doctor' | 'admin';

const DASHBOARD_SCREENS = new Set(['patient-dashboard', 'doctor-dashboard', 'admin-dashboard']);

export function isDashboardScreen(screenId?: string): boolean {
  return Boolean(screenId && DASHBOARD_SCREENS.has(screenId));
}

/** Header title: "Dashboard" on home screens; otherwise use nav label fallback. */
export function getDashboardHeaderTitle(screenId?: string, fallback = 'Dashboard'): string {
  if (isDashboardScreen(screenId)) return 'Dashboard';
  return fallback;
}

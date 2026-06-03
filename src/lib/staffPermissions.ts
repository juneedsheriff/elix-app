import type { Admin, AdminRole } from '../types/admin';

export function isAdministrator(admin: Pick<Admin, 'role'>): boolean {
  return admin.role === 'administrator';
}

export function isPatientServiceExecutive(admin: Pick<Admin, 'role'>): boolean {
  return admin.role === 'patient_service_executive';
}

export function adminRoleLabel(role: AdminRole): string {
  if (role === 'patient_service_executive') return 'Patient Service Executive';
  return 'Administrator';
}

export type ElixHealthNavId = 'overview' | 'doctors' | 'patients' | 'requests' | 'staff';

export function navItemsForRole(role: AdminRole): ElixHealthNavId[] {
  if (role === 'patient_service_executive') {
    return ['overview', 'requests', 'doctors', 'patients'];
  }
  return ['overview', 'doctors', 'patients', 'requests', 'staff'];
}

export function requestsNavLabel(role: AdminRole): string {
  return role === 'patient_service_executive' ? 'My requests' : 'Requests';
}

export function canEditProfiles(admin: Pick<Admin, 'role'>): boolean {
  return isAdministrator(admin);
}

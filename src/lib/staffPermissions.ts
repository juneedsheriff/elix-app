import type { Admin, AdminRole } from '../types/admin';

export function isAdministrator(admin: Pick<Admin, 'role'>): boolean {
  return admin.role === 'administrator';
}

export function isPatientServiceExecutive(admin: Pick<Admin, 'role'>): boolean {
  return admin.role === 'patient_service_executive';
}

export function isClinicPatientServiceExecutive(admin: Pick<Admin, 'role'>): boolean {
  return admin.role === 'patient_service_executive_clinic';
}

export function isAnyPatientServiceExecutive(admin: Pick<Admin, 'role'>): boolean {
  return isPatientServiceExecutive(admin) || isClinicPatientServiceExecutive(admin);
}

export function adminRoleLabel(role: AdminRole): string {
  if (role === 'patient_service_executive') return 'Patient Service Executive';
  if (role === 'patient_service_executive_clinic') return 'Patient Service Executive (clinic)';
  return 'Administrator';
}

export type ElixHealthNavId = 'overview' | 'doctors' | 'patients' | 'requests' | 'staff';

export function navItemsForRole(role: AdminRole): ElixHealthNavId[] {
  if (isAnyPatientServiceExecutive({ role })) {
    return ['overview', 'requests', 'doctors', 'patients'];
  }
  return ['overview', 'doctors', 'patients', 'requests', 'staff'];
}

export function requestsNavLabel(role: AdminRole): string {
  return isAnyPatientServiceExecutive({ role }) ? 'My requests' : 'Requests';
}

export function canEditProfiles(admin: Pick<Admin, 'role'>): boolean {
  return isAdministrator(admin) || isClinicPatientServiceExecutive(admin);
}

export function canCreatePatients(admin: Pick<Admin, 'role'>): boolean {
  return isClinicPatientServiceExecutive(admin);
}

export function canCreateDoctors(admin: Pick<Admin, 'role'>): boolean {
  return isAdministrator(admin) || isClinicPatientServiceExecutive(admin);
}

export function canSelfAssignRequests(admin: Pick<Admin, 'role'>): boolean {
  return isClinicPatientServiceExecutive(admin);
}

export function canCreateRequests(admin: Pick<Admin, 'role'>): boolean {
  return isClinicPatientServiceExecutive(admin);
}

export function canRequestPlatformDoctors(admin: Pick<Admin, 'role'>): boolean {
  return isClinicPatientServiceExecutive(admin);
}

export function canReviewClinicDoctorRequests(admin: Pick<Admin, 'role'>): boolean {
  return isAdministrator(admin);
}

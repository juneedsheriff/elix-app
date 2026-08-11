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
  return 'ElixClinix';
}

export type ElixHealthNavId = 'overview' | 'doctors' | 'patients' | 'requests' | 'staff' | 'profile';

export function navItemsForRole(role: AdminRole): ElixHealthNavId[] {
  if (isAnyPatientServiceExecutive({ role })) {
    return ['requests', 'doctors', 'patients', 'profile'];
  }
  if (isAdministrator({ role })) {
    return ['overview', 'doctors', 'patients', 'requests', 'staff', 'profile'];
  }
  return ['overview', 'doctors', 'patients', 'requests', 'staff'];
}

/** Default route after staff sign-in. */
export function staffLandingNavId(role: AdminRole): ElixHealthNavId {
  return isAnyPatientServiceExecutive({ role }) ? 'requests' : 'overview';
}

export function canManageStaffProfiles(admin: Pick<Admin, 'role'>): boolean {
  return isAdministrator(admin);
}

export function requestsNavLabel(role: AdminRole): string {
  if (isClinicPatientServiceExecutive({ role })) return 'Patient Requests';
  if (isAnyPatientServiceExecutive({ role })) return 'My requests';
  return 'Requests';
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

/** Clinic PSE: create consultation + home care requests from staff tools. */
export function canCreateRequests(admin: Pick<Admin, 'role'>): boolean {
  return isClinicPatientServiceExecutive(admin);
}

/** Book a consultation for a patient (clinic PSE only). */
export function canBookConsultation(admin: Pick<Admin, 'role'>): boolean {
  return isClinicPatientServiceExecutive(admin);
}

/** Home care tab / request actions (clinic PSE when clinic has Home Care enabled + admin). */
export function canAccessHomeCareRequests(
  admin: Pick<Admin, 'role' | 'clinic_home_care_enabled'>
): boolean {
  if (isAdministrator(admin)) return true;
  if (!isClinicPatientServiceExecutive(admin)) return false;
  // Missing flag (pre-migration) defaults to enabled so existing clinics keep access.
  return admin.clinic_home_care_enabled !== false;
}

/** Soft-delete patients (admin: all; clinic PSE: own clinic via RLS). */
export function canDeletePatients(admin: Pick<Admin, 'role'>): boolean {
  return isAdministrator(admin) || isClinicPatientServiceExecutive(admin);
}

/** Delete opinion requests (admin: all; clinic PSE: own clinic via RPC). */
export function canDeleteRequests(admin: Pick<Admin, 'role'>): boolean {
  return isAdministrator(admin) || isClinicPatientServiceExecutive(admin);
}

export function canRequestPlatformDoctors(admin: Pick<Admin, 'role'>): boolean {
  return isClinicPatientServiceExecutive(admin);
}

export function canReviewClinicDoctorRequests(admin: Pick<Admin, 'role'>): boolean {
  return isAdministrator(admin);
}

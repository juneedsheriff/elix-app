export type AdminRole = 'administrator' | 'patient_service_executive' | 'patient_service_executive_clinic';

export type Admin = {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  role: AdminRole;
  clinic_id: string | null;
  clinic_name: string | null;
  /** Home Care enabled for the staff member’s clinic workspace (clinic PSE only). */
  clinic_home_care_enabled?: boolean | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

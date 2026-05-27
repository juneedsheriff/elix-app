export type AdminRole = 'administrator' | 'patient_service_executive';

export type Admin = {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

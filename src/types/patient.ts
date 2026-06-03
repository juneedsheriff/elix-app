export type Patient = {
  id: string;
  elix_id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string | null;
  country: string | null;
  city: string | null;
  allergies: string | null;
  current_medications: string | null;
  insurance_provider: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  preferred_language: string;
  avatar_url: string | null;
  login_disabled?: boolean;
  created_at: string;
  updated_at: string;
};

export type PatientUpsertInput = {
  full_name: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  preferred_language?: string;
};

export type PatientProfileUpdateInput = {
  full_name: string;
  phone?: string | null;
};

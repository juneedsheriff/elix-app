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
  address: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  allergies: string | null;
  current_medications: string | null;
  insurance_provider: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  preferred_language: string;
  avatar_url: string | null;
  profile_completed_at: string | null;
  login_disabled?: boolean;
  created_at: string;
  updated_at: string;
  /** PSE clinic workspace when managed by clinic PSE */
  clinic_id?: string | null;
  pse_clinic_name?: string | null;
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
  date_of_birth?: string | null;
  gender?: string | null;
  blood_group?: string | null;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  allergies?: string | null;
  current_medications?: string | null;
  insurance_provider?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  preferred_language?: string;
};

export type PatientOnboardingInput = {
  phone: string;
  gender: string;
  date_of_birth: string;
  address: string;
  blood_group: string;
  height_cm?: number | null;
  weight_kg?: number | null;
};

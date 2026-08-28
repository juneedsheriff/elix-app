/** Optional government ID types for patient identity fields. */
export const PATIENT_GOVT_ID_TYPES = [
  'Aadhar',
  'Driving License',
  'PAN',
  'Ayushman Card ID',
  "Voter's ID"
] as const;

export type PatientGovtIdType = (typeof PATIENT_GOVT_ID_TYPES)[number];

/** Metadata for a file attached to the patient profile (govt ID or prescription). */
export type PatientAttachedDocument = {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type?: string | null;
  uploaded_at: string;
};

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
  pin_code: string | null;
  govt_id_type: string | null;
  govt_id_number: string | null;
  govt_id_documents: PatientAttachedDocument[];
  latest_prescription_documents: PatientAttachedDocument[];
  height_cm: number | null;
  weight_kg: number | null;
  allergies: string | null;
  family_history: string | null;
  social_history: string | null;
  surgical_history: string | null;
  medical_history: string | null;
  current_medications: string | null;
  insurance_provider: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  preferred_language: string;
  avatar_url: string | null;
  profile_completed_at: string | null;
  login_disabled?: boolean;
  /** Soft-delete marker — deleted patients must not sign in or create requests */
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  /** PSE clinic workspace when managed by clinic PSE */
  clinic_id?: string | null;
  pse_clinic_name?: string | null;
  /** Nearest upcoming (or most recent past) doctor consultation follow-up date (YYYY-MM-DD). */
  consultation_followup_date?: string | null;
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
  pin_code?: string | null;
  govt_id_type?: string | null;
  govt_id_number?: string | null;
  govt_id_documents?: PatientAttachedDocument[];
  latest_prescription_documents?: PatientAttachedDocument[];
  height_cm?: number | null;
  weight_kg?: number | null;
  allergies?: string | null;
  family_history?: string | null;
  social_history?: string | null;
  surgical_history?: string | null;
  medical_history?: string | null;
  current_medications?: string | null;
  insurance_provider?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  preferred_language?: string;
  avatar_url?: string | null;
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

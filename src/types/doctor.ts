export type ConsultationHoursDay = {
  enabled: boolean;
  start: string;
  end: string;
};

export type ConsultationHours = {
  monday: ConsultationHoursDay;
  tuesday: ConsultationHoursDay;
  wednesday: ConsultationHoursDay;
  thursday: ConsultationHoursDay;
  friday: ConsultationHoursDay;
  saturday: ConsultationHoursDay;
  sunday: ConsultationHoursDay;
};

export type TimeSettings = {
  notes?: string;
  buffer_minutes?: number;
  lunch_break_start?: string;
  lunch_break_end?: string;
};

export type ConsultationCurrency = 'USD' | 'INR';

export type ConsultationTier = {
  duration_minutes: number;
  fee_usd: number;
};

export type Doctor = {
  id: string;
  full_name: string;
  gender: string | null;
  mobile_no: string | null;
  email: string;
  medical_license_no: string | null;
  qualification: string | null;
  start_of_practice: string | null;
  specialty: string;
  specialization: string | null;
  about_doctor: string | null;
  work_experience: string | null;
  awards_recognitions: string | null;
  membership: string | null;
  clinic_name: string | null;
  clinic_specialization: string | null;
  about_clinic: string | null;
  clinic_website: string | null;
  clinic_country: string | null;
  clinic_state: string | null;
  clinic_city: string | null;
  clinic_location: string | null;
  clinic_street: string | null;
  clinic_zipcode: string | null;
  scheduler_effect_from: string | null;
  scheduler_time_interval: number | null;
  consultation_fee: number | null;
  consultation_tiers?: ConsultationTier[];
  consultation_currency?: ConsultationCurrency;
  elix_patient_priority: boolean;
  scheduler_color: string | null;
  consultation_hours: ConsultationHours;
  time_settings: TimeSettings;
  /** @deprecated Use mobile_no — kept for patient app compatibility */
  phone: string;
  years_experience: number;
  /** @deprecated Use clinic_name */
  hospital: string;
  rating: number;
  languages: string;
  /** @deprecated Use consultation_fee */
  fee_usd: number;
  image_url: string;
  /** @deprecated Use clinic_country */
  country: string;
  /** @deprecated Use about_doctor */
  bio: string | null;
  is_visible?: boolean;
  deleted_at?: string | null;
  auth_user_id?: string | null;
  login_disabled?: boolean;
  created_at?: string;
};

export type AdminDoctorUpdateInput = {
  full_name: string;
  gender: string | null;
  mobile_no: string;
  email: string;
  medical_license_no: string | null;
  qualification: string | null;
  start_of_practice: string | null;
  specialty: string;
  specialization: string | null;
  about_doctor: string | null;
  work_experience: string | null;
  awards_recognitions: string | null;
  membership: string | null;
  clinic_name: string;
  clinic_specialization: string | null;
  about_clinic: string | null;
  clinic_website: string | null;
  clinic_country: string;
  clinic_state: string | null;
  clinic_city: string | null;
  clinic_location: string | null;
  clinic_street: string | null;
  clinic_zipcode: string | null;
  scheduler_effect_from: string | null;
  scheduler_time_interval: number | null;
  consultation_fee: number;
  consultation_tiers: ConsultationTier[];
  consultation_currency: ConsultationCurrency;
  elix_patient_priority: boolean;
  scheduler_color: string;
  consultation_hours: ConsultationHours;
  time_settings: TimeSettings;
  years_experience: number;
  rating: number;
  languages: string;
  image_url: string;
};

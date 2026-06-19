export type ClinicDoctorRequestStatus = 'pending' | 'approved' | 'rejected';

export type DoctorWorkspaceLink = {
  doctorId: string;
  clinicId: string;
  clinicName: string;
  linkType: 'owned' | 'granted';
};

export type PlatformDoctorSearchResult = {
  id: string;
  full_name: string;
  email: string;
  specialty: string;
  clinic_name: string | null;
  clinic_city: string | null;
  clinic_country: string | null;
  qualification: string | null;
};

export type ClinicDoctorRequest = {
  id: string;
  clinic_id: string;
  doctor_id: string;
  requested_by: string;
  message: string | null;
  status: ClinicDoctorRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
  doctor_name?: string | null;
  doctor_specialty?: string | null;
  doctor_email?: string | null;
  clinic_name?: string | null;
  requested_by_name?: string | null;
};

export type OpinionRequestStatus = 'submitted' | 'in_review' | 'closed';

export type ConsultationStage =
  | 'new'
  | 'assigned'
  | 'recommended'
  | 'doctor_selected'
  | 'availability_submitted'
  | 'schedule_proposed'
  | 'schedule_confirmed'
  | 'scheduled'
  | 'payment_pending'
  | 'paid'
  | 'completed';

export type PaymentStatus = 'unpaid' | 'pending' | 'paid';

export type OpinionRequestFile = {
  id: string;
  file_name: string;
  summary: string | null;
  storage_path: string | null;
};

export type OpinionRequestRecommendation = {
  id: string;
  request_id: string;
  doctor_id: string;
  rank: number | null;
  note: string | null;
  created_at: string;
  doctor_name: string | null;
  doctor_specialty: string | null;
};

export type ConsultationSummary = {
  id: string;
  request_id: string;
  doctor_id: string;
  patient_auth_user_id: string | null;
  chief_complaint: string | null;
  history_present_illness: string | null;
  vital_signs: string | null;
  current_medications: string | null;
  labs_diagnostics: string | null;
  assessment_plan: string | null;
  prescription: string | null;
  pdf_storage_path: string | null;
  created_at: string;
  updated_at: string;
};

export type OpinionRequest = {
  id: string;
  message: string;
  status: OpinionRequestStatus;
  created_at: string;
  patient_id: string | null;
  patient_name: string | null;
  doctor_id: string;
  doctor_name: string | null;
  doctor_specialty: string | null;
  patient_email: string | null;
  doctor_response: string | null;
  responded_at: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  assigned_to_name: string | null;
  coordination_notes: string | null;
  consultation_stage: ConsultationStage | null;
  selected_doctor_id: string | null;
  patient_availability: unknown | null;
  scheduled_at: string | null;
  meeting_link: string | null;
  payment_status: PaymentStatus | null;
  payment_amount: number | null;
  payment_currency: string | null;
  payment_reference: string | null;
  payment_confirmed_at: string | null;
  payment_link: string | null;
  payment_proof_storage_path: string | null;
  payment_proof_file_name: string | null;
  payment_proof_mime_type: string | null;
  payment_proof_submitted_at: string | null;
  pse_scheduling_message: string | null;
  schedule_confirmed_at: string | null;
  records_verified_at: string | null;
  records: OpinionRequestFile[];
  recommendations?: OpinionRequestRecommendation[];
  consultation_summary?: ConsultationSummary | null;
};

/** @deprecated Use OpinionRequest */
export type DoctorOpinionRequest = OpinionRequest;

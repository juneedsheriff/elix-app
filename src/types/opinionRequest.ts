export type OpinionRequestStatus = 'submitted' | 'in_review' | 'closed';

export type OpinionRequestFile = {
  id: string;
  file_name: string;
  summary: string | null;
  storage_path: string | null;
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
  records: OpinionRequestFile[];
};

/** @deprecated Use OpinionRequest */
export type DoctorOpinionRequest = OpinionRequest;

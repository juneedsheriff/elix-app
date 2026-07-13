export const SECOND_OPINION_REASON_OPTIONS = [
  'Confirm diagnosis',
  'Review treatment plan',
  'Consider alternative treatments',
  'Surgical recommendation review',
  'Other'
] as const;

export type SecondOpinionReason = (typeof SECOND_OPINION_REASON_OPTIONS)[number];

export const SYMPTOM_SEVERITY_OPTIONS = ['Mild', 'Moderate', 'Severe'] as const;

export type SymptomSeverity = (typeof SYMPTOM_SEVERITY_OPTIONS)[number];

export const SECOND_OPINION_QUESTION_OPTIONS = [
  'Is the diagnosis correct?',
  'Are there alternative treatments?',
  'Is surgery necessary?',
  'What are the risks and benefits?',
  'Other'
] as const;

export type SecondOpinionQuestion = (typeof SECOND_OPINION_QUESTION_OPTIONS)[number];

export const CONSULTATION_MODE_OPTIONS = ['Video Call', 'Audio Call', 'Written Review'] as const;

export type ConsultationMode = (typeof CONSULTATION_MODE_OPTIONS)[number];

export type PreferredTimeSlot = {
  date: string;
  time: string;
};

export type PatientCaseVitalSigns = {
  bloodPressure: string;
  pulseRate: string;
  respiratoryRate: string;
  temperature: string;
  spo2: string;
  height: string;
  weight: string;
};

export type PatientCaseDetails = {
  primaryHealthConcern: string;
  specialtyRequired: string;
  reasonForSecondOpinion: SecondOpinionReason | '';
  reasonForSecondOpinionOther: string;
  symptomsDescription: string;
  symptomsStartedDate: string;
  vitalSigns: PatientCaseVitalSigns;
  currentDiagnosis: string;
  symptomSeverity: SymptomSeverity | '';
  currentTreatmentPlan: string;
  existingMedicalConditions: string;
  previousSurgeries: string;
  familyHistory: string;
  socialHistory: string;
  knownAllergies: string;
  currentMedications: string;
  treatingDoctorName: string;
  hospitalClinicName: string;
  treatingDoctorSpecialty: string;
  lastConsultationDate: string;
  questionCategories: SecondOpinionQuestion[];
  questionCategoriesOther: string;
  additionalQuestions: string;
  preferredConsultationMode: ConsultationMode | '';
  preferredLanguages: string[];
  preferredTimeSlots: PreferredTimeSlot[];
  consentInformationAccurate: boolean;
  consentShareRecords: boolean;
  consentNotEmergencyCare: boolean;
};

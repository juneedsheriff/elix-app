import type { OpinionRequest } from '../types/opinionRequest';
import type { Patient } from '../types/patient';
import type { PatientCaseDetails, PatientCaseVitalSigns } from '../types/patientCaseDetails';

export function emptyPatientCaseVitalSigns(
  overrides: Partial<PatientCaseVitalSigns> = {}
): PatientCaseVitalSigns {
  return {
    bloodPressure: '',
    pulseRate: '',
    respiratoryRate: '',
    temperature: '',
    spo2: '',
    height: '',
    weight: '',
    ...overrides
  };
}

export function emptyPatientCaseDetails(
  overrides: Partial<PatientCaseDetails> = {}
): PatientCaseDetails {
  return {
    primaryHealthConcern: '',
    specialtyRequired: '',
    reasonForSecondOpinion: '',
    reasonForSecondOpinionOther: '',
    symptomsDescription: '',
    symptomsStartedDate: '',
    vitalSigns: emptyPatientCaseVitalSigns(),
    currentDiagnosis: '',
    symptomSeverity: '',
    currentTreatmentPlan: '',
    existingMedicalConditions: '',
    previousSurgeries: '',
    familyHistory: '',
    socialHistory: '',
    knownAllergies: '',
    currentMedications: '',
    treatingDoctorName: '',
    hospitalClinicName: '',
    treatingDoctorSpecialty: '',
    lastConsultationDate: '',
    questionCategories: [],
    questionCategoriesOther: '',
    additionalQuestions: '',
    preferredConsultationMode: '',
    preferredLanguages: [],
    preferredTimeSlots: [],
    consentInformationAccurate: false,
    consentShareRecords: false,
    consentNotEmergencyCare: false,
    ...overrides,
    vitalSigns: emptyPatientCaseVitalSigns(overrides.vitalSigns)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function readTimeSlots(value: unknown): PatientCaseDetails['preferredTimeSlots'] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((slot) => ({
      date: readString(slot.date),
      time: readString(slot.time)
    }))
    .filter((slot) => slot.date && slot.time);
}

function parseVitalSigns(value: unknown): PatientCaseVitalSigns {
  if (!isRecord(value)) return emptyPatientCaseVitalSigns();
  return emptyPatientCaseVitalSigns({
    bloodPressure: readString(value.bloodPressure),
    pulseRate: readString(value.pulseRate),
    respiratoryRate: readString(value.respiratoryRate),
    temperature: readString(value.temperature),
    spo2: readString(value.spo2),
    height: readString(value.height),
    weight: readString(value.weight)
  });
}

export function parsePatientCaseDetails(value: unknown): PatientCaseDetails | null {
  if (!isRecord(value)) return null;
  return emptyPatientCaseDetails({
    primaryHealthConcern: readString(value.primaryHealthConcern),
    specialtyRequired: readString(value.specialtyRequired),
    reasonForSecondOpinion: readString(value.reasonForSecondOpinion) as PatientCaseDetails['reasonForSecondOpinion'],
    reasonForSecondOpinionOther: readString(value.reasonForSecondOpinionOther),
    symptomsDescription: readString(value.symptomsDescription),
    symptomsStartedDate: readString(value.symptomsStartedDate),
    vitalSigns: parseVitalSigns(value.vitalSigns),
    currentDiagnosis: readString(value.currentDiagnosis),
    symptomSeverity: readString(value.symptomSeverity) as PatientCaseDetails['symptomSeverity'],
    currentTreatmentPlan: readString(value.currentTreatmentPlan),
    existingMedicalConditions: readString(value.existingMedicalConditions),
    previousSurgeries: readString(value.previousSurgeries),
    familyHistory: readString(value.familyHistory),
    socialHistory: readString(value.socialHistory),
    knownAllergies: readString(value.knownAllergies),
    currentMedications: readString(value.currentMedications),
    treatingDoctorName: readString(value.treatingDoctorName),
    hospitalClinicName: readString(value.hospitalClinicName),
    treatingDoctorSpecialty: readString(value.treatingDoctorSpecialty),
    lastConsultationDate: readString(value.lastConsultationDate),
    questionCategories: readStringArray(value.questionCategories) as PatientCaseDetails['questionCategories'],
    questionCategoriesOther: readString(value.questionCategoriesOther),
    additionalQuestions: readString(value.additionalQuestions),
    preferredConsultationMode: readString(
      value.preferredConsultationMode
    ) as PatientCaseDetails['preferredConsultationMode'],
    preferredLanguages: readStringArray(value.preferredLanguages),
    preferredTimeSlots: readTimeSlots(value.preferredTimeSlots),
    consentInformationAccurate: value.consentInformationAccurate === true,
    consentShareRecords: value.consentShareRecords === true,
    consentNotEmergencyCare: value.consentNotEmergencyCare === true
  });
}

export function hasStoredPatientCaseDetails(
  request: Pick<OpinionRequest, 'patient_case_details' | 'message'>
): boolean {
  if (request.patient_case_details != null) return true;
  return Boolean(request.message?.trim());
}

export function caseDetailsFromRequest(request: OpinionRequest): PatientCaseDetails {
  const stored = parsePatientCaseDetails(request.patient_case_details);
  if (stored) {
    return emptyPatientCaseDetails({
      ...stored,
      specialtyRequired:
        stored.specialtyRequired ||
        request.requested_specialty ||
        request.doctor_specialty ||
        '',
      primaryHealthConcern: stored.primaryHealthConcern || request.message || ''
    });
  }

  return emptyPatientCaseDetails({
    primaryHealthConcern: request.message ?? '',
    specialtyRequired: request.requested_specialty ?? request.doctor_specialty ?? '',
    symptomsDescription: request.message ?? ''
  });
}

export function serializePatientCaseDetails(details: PatientCaseDetails): Record<string, unknown> {
  return {
    primaryHealthConcern: details.primaryHealthConcern.trim(),
    specialtyRequired: details.specialtyRequired.trim(),
    reasonForSecondOpinion: details.reasonForSecondOpinion || null,
    reasonForSecondOpinionOther: details.reasonForSecondOpinionOther.trim() || null,
    symptomsDescription: details.symptomsDescription.trim(),
    symptomsStartedDate: details.symptomsStartedDate || null,
    vitalSigns: {
      bloodPressure: details.vitalSigns.bloodPressure.trim() || null,
      pulseRate: details.vitalSigns.pulseRate.trim() || null,
      respiratoryRate: details.vitalSigns.respiratoryRate.trim() || null,
      temperature: details.vitalSigns.temperature.trim() || null,
      spo2: details.vitalSigns.spo2.trim() || null,
      height: details.vitalSigns.height.trim() || null,
      weight: details.vitalSigns.weight.trim() || null
    },
    currentDiagnosis: details.currentDiagnosis.trim() || null,
    symptomSeverity: details.symptomSeverity || null,
    currentTreatmentPlan: details.currentTreatmentPlan.trim() || null,
    existingMedicalConditions: details.existingMedicalConditions.trim() || null,
    previousSurgeries: details.previousSurgeries.trim() || null,
    familyHistory: details.familyHistory.trim() || null,
    socialHistory: details.socialHistory.trim() || null,
    knownAllergies: details.knownAllergies.trim() || null,
    currentMedications: details.currentMedications.trim() || null,
    treatingDoctorName: details.treatingDoctorName.trim() || null,
    hospitalClinicName: details.hospitalClinicName.trim() || null,
    treatingDoctorSpecialty: details.treatingDoctorSpecialty.trim() || null,
    lastConsultationDate: details.lastConsultationDate || null,
    questionCategories: details.questionCategories,
    questionCategoriesOther: details.questionCategoriesOther.trim() || null,
    additionalQuestions: details.additionalQuestions.trim() || null,
    preferredConsultationMode: details.preferredConsultationMode || null,
    preferredLanguages: details.preferredLanguages,
    preferredTimeSlots: details.preferredTimeSlots,
    consentInformationAccurate: details.consentInformationAccurate,
    consentShareRecords: details.consentShareRecords,
    consentNotEmergencyCare: details.consentNotEmergencyCare
  };
}

export function applyPatientProfileHistoryDefaults(
  details: PatientCaseDetails,
  patient: Patient | null | undefined
): PatientCaseDetails {
  if (!patient) return details;

  return emptyPatientCaseDetails({
    ...details,
    existingMedicalConditions: details.existingMedicalConditions || patient.medical_history || '',
    previousSurgeries: details.previousSurgeries || patient.surgical_history || '',
    familyHistory: details.familyHistory || patient.family_history || '',
    socialHistory: details.socialHistory || patient.social_history || '',
    knownAllergies: details.knownAllergies || patient.allergies || '',
    currentMedications: details.currentMedications || patient.current_medications || '',
    vitalSigns: emptyPatientCaseVitalSigns({
      ...details.vitalSigns,
      height:
        details.vitalSigns.height ||
        (patient.height_cm != null ? String(patient.height_cm) : ''),
      weight:
        details.vitalSigns.weight ||
        (patient.weight_kg != null ? String(patient.weight_kg) : '')
    })
  });
}

export function validatePatientCaseDetails(
  _details: PatientCaseDetails,
  _options: {
    requireConsent?: boolean;
    requireSpecialty?: boolean;
    submitOnly?: boolean;
  } = {}
): string | null {
  return null;
}

export function formatCaseDetailValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : 'Not provided';
}

export function formatCaseDetailList(values: string[] | null | undefined): string {
  if (!values?.length) return 'Not provided';
  return values.join(', ');
}

export function formatPreferredTimeSlots(
  slots: PatientCaseDetails['preferredTimeSlots'] | null | undefined
): string {
  if (!slots?.length) return 'Not provided';
  return slots
    .map((slot) => {
      const date = slot.date ? new Date(`${slot.date}T00:00:00`).toLocaleDateString() : '';
      return `${date} ${slot.time}`.trim();
    })
    .join('; ');
}

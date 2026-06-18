import { hasConsultationSummary } from './consultationWizard';
import type { OpinionRequest } from '../types/opinionRequest';

/** Whether the doctor can open the structured consultation form for this request. */
export function canDoctorGiveConsultation(request: OpinionRequest): boolean {
  if (request.consultation_stage === 'completed') return false;
  return true;
}

/** Request is on the doctor's queue but PSE coordination may still be running. */
export function isDoctorConsultationAwaitingCoordination(request: OpinionRequest): boolean {
  return (
    request.status === 'submitted' &&
    request.consultation_stage !== 'paid' &&
    request.payment_status !== 'paid' &&
    !request.doctor_response?.trim()
  );
}

/** Whether the doctor has submitted consultation notes for this request. */
export function hasPatientConsultationNotes(request: OpinionRequest): boolean {
  return (
    hasConsultationSummary(request.consultation_summary) || Boolean(request.doctor_response?.trim())
  );
}

export function consultationNotesPreview(request: OpinionRequest, maxLength = 72): string | null {
  const summary = request.consultation_summary;
  const text =
    summary?.assessment_plan?.trim() ||
    summary?.chief_complaint?.trim() ||
    request.doctor_response?.trim() ||
    null;
  if (!text) return null;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

export function doctorConsultationButtonLabel(request: OpinionRequest): string {
  if (request.doctor_response?.trim()) {
    return 'Update consultation';
  }
  return 'Give consultation';
}

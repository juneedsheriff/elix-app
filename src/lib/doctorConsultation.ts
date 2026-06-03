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

export function doctorConsultationButtonLabel(request: OpinionRequest): string {
  if (request.doctor_response?.trim()) {
    return 'Update consultation';
  }
  return 'Give consultation';
}

import { saveReturnScreen } from './appRoutes';

export const DOCTOR_CONSULTATION_REQUEST_KEY = 'elix:doctorConsultationRequestId';

export function setDoctorConsultationRequestId(requestId: string) {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(DOCTOR_CONSULTATION_REQUEST_KEY, requestId);
}

export function getDoctorConsultationRequestId(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(DOCTOR_CONSULTATION_REQUEST_KEY);
}

export function clearDoctorConsultationRequestId() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(DOCTOR_CONSULTATION_REQUEST_KEY);
}

export function openDoctorConsultation(
  requestId: string,
  onNavigate: (screenId: string) => void,
  returnScreen = 'case-review'
) {
  saveReturnScreen(returnScreen);
  setDoctorConsultationRequestId(requestId);
  onNavigate('doctor-consultation');
}

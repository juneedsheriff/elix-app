import { saveReturnScreen } from './appRoutes';

export const DOCTOR_CONSULTATION_REQUEST_KEY = 'elix:doctorConsultationRequestId';
export const DOCTOR_CONSULTATION_OPEN_CASE_CONTEXT_KEY = 'elix:doctorConsultationOpenCaseContext';

export function setDoctorConsultationRequestId(requestId: string) {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(DOCTOR_CONSULTATION_REQUEST_KEY, requestId);
}

export function getDoctorConsultationRequestId(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(DOCTOR_CONSULTATION_REQUEST_KEY);
}

export function setDoctorConsultationOpenCaseContext(open: boolean) {
  if (typeof sessionStorage === 'undefined') return;
  if (open) {
    sessionStorage.setItem(DOCTOR_CONSULTATION_OPEN_CASE_CONTEXT_KEY, '1');
  } else {
    sessionStorage.removeItem(DOCTOR_CONSULTATION_OPEN_CASE_CONTEXT_KEY);
  }
}

export function consumeDoctorConsultationOpenCaseContext(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  const shouldOpen = sessionStorage.getItem(DOCTOR_CONSULTATION_OPEN_CASE_CONTEXT_KEY) === '1';
  sessionStorage.removeItem(DOCTOR_CONSULTATION_OPEN_CASE_CONTEXT_KEY);
  return shouldOpen;
}

export function clearDoctorConsultationRequestId() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(DOCTOR_CONSULTATION_REQUEST_KEY);
  sessionStorage.removeItem(DOCTOR_CONSULTATION_OPEN_CASE_CONTEXT_KEY);
}

export function openDoctorConsultation(
  requestId: string,
  onNavigate: (screenId: string) => void,
  returnScreen = 'case-review',
  options?: { openCaseContext?: boolean }
) {
  saveReturnScreen(returnScreen);
  setDoctorConsultationRequestId(requestId);
  if (options?.openCaseContext) {
    setDoctorConsultationOpenCaseContext(true);
  }
  onNavigate('doctor-consultation');
}

import type { Doctor } from '../types/doctor';
import type { Patient } from '../types/patient';

export type ScreenPageProps = {
  userId?: string | null;
  userEmail?: string | null;
  doctorProfile?: Doctor | null;
  patientProfile?: Patient | null;
  dbConnected: boolean;
  onSignOut?: () => void;
  onNavigate?: (screenId: string) => void;
  onRequestProfileSetup?: () => void;
};

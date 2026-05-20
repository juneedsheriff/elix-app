export type Role = 'patient' | 'doctor' | 'admin';

export type ThemeMode = 'light' | 'dark';

export interface PatientProfile {
  name: string;
  age: number;
  gender: string;
  country: string;
  bloodGroup: string;
  allergies: string[];
  medications: string[];
  medicalHistory: string[];
}

export interface MedicalRecord {
  id: string;
  title: string;
  type: 'pdf' | 'image' | 'mri' | 'lab' | 'voice';
  uploadedAt: string;
  status: 'processing' | 'analyzed' | 'shared';
  size: string;
}

export interface OpinionRequest {
  id: string;
  specialty: string;
  doctor: string;
  urgency: 'urgent' | 'non-urgent';
  status: 'pending' | 'in_review' | 'completed';
  createdAt: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  languages: string[];
  country: string;
  rating: number;
  successRate: number;
  fee: number;
  experienceYears: number;
}

export interface NotificationItem {
  id: string;
  channel: 'push' | 'sms' | 'email';
  title: string;
  message: string;
  timestamp: string;
}

export interface Metric {
  label: string;
  value: string;
  delta: string;
}

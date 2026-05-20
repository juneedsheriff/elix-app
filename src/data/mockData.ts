import {
  Doctor,
  MedicalRecord,
  Metric,
  NotificationItem,
  OpinionRequest,
  PatientProfile,
} from '../types';

export const patientProfile: PatientProfile = {
  name: 'Ava Thompson',
  age: 34,
  gender: 'Female',
  country: 'United Kingdom',
  bloodGroup: 'O+',
  allergies: ['Penicillin', 'Dust mites'],
  medications: ['Atorvastatin 10mg', 'Vitamin D3'],
  medicalHistory: ['Hypertension', 'Post-partum thyroiditis (resolved)'],
};

export const records: MedicalRecord[] = [
  {
    id: 'REC-9081',
    title: 'Cardiac MRI - March 2026',
    type: 'mri',
    uploadedAt: '2h ago',
    status: 'analyzed',
    size: '82 MB',
  },
  {
    id: 'REC-9027',
    title: 'Blood panel report',
    type: 'lab',
    uploadedAt: 'Yesterday',
    status: 'shared',
    size: '1.3 MB',
  },
  {
    id: 'REC-8990',
    title: 'Voice symptom note',
    type: 'voice',
    uploadedAt: '3 days ago',
    status: 'processing',
    size: '16 MB',
  },
];

export const opinionRequests: OpinionRequest[] = [
  {
    id: 'SO-1204',
    specialty: 'Cardiology',
    doctor: 'Dr. Lina Alvarez',
    urgency: 'urgent',
    status: 'in_review',
    createdAt: 'Today, 07:15',
  },
  {
    id: 'SO-1181',
    specialty: 'Endocrinology',
    doctor: 'Dr. Noor Al-Hassan',
    urgency: 'non-urgent',
    status: 'completed',
    createdAt: 'Mon, 16:30',
  },
];

export const doctors: Doctor[] = [
  {
    id: 'DOC-1',
    name: 'Dr. Lina Alvarez',
    specialty: 'Interventional Cardiology',
    languages: ['English', 'Spanish'],
    country: 'Spain',
    rating: 4.9,
    successRate: 97,
    fee: 220,
    experienceYears: 16,
  },
  {
    id: 'DOC-2',
    name: 'Dr. Noah Patel',
    specialty: 'Neurology',
    languages: ['English', 'Hindi'],
    country: 'United States',
    rating: 4.8,
    successRate: 95,
    fee: 240,
    experienceYears: 12,
  },
  {
    id: 'DOC-3',
    name: 'Dr. Noor Al-Hassan',
    specialty: 'Endocrinology',
    languages: ['English', 'Arabic'],
    country: 'United Arab Emirates',
    rating: 4.9,
    successRate: 98,
    fee: 180,
    experienceYears: 14,
  },
];

export const patientMetrics: Metric[] = [
  { label: 'Active Cases', value: '3', delta: '+1 this week' },
  { label: 'Doctors Consulted', value: '12', delta: 'Across 7 countries' },
  { label: 'AI Accuracy Score', value: '94%', delta: 'Improved +3%' },
  { label: 'Wallet Balance', value: '$410', delta: 'International enabled' },
];

export const doctorMetrics: Metric[] = [
  { label: 'Pending Reviews', value: '14', delta: '4 urgent' },
  { label: 'Monthly Earnings', value: '$18,920', delta: '+12.4%' },
  { label: 'Consultation Rating', value: '4.92', delta: 'Top 2% global' },
  { label: 'Avg Turnaround', value: '11h', delta: '-2.1h faster' },
];

export const adminMetrics: Metric[] = [
  { label: 'Global Patients', value: '182,442', delta: '+8.4%' },
  { label: 'Verified Doctors', value: '9,208', delta: '+310 this month' },
  { label: 'Active Consultations', value: '7,610', delta: 'Real-time' },
  { label: 'Gross Revenue', value: '$12.4M', delta: '+19.2%' },
];

export const notifications: NotificationItem[] = [
  {
    id: 'N1',
    channel: 'push',
    title: 'Second opinion submitted',
    message: 'Dr. Lina Alvarez posted a detailed opinion with treatment options.',
    timestamp: '4 min ago',
  },
  {
    id: 'N2',
    channel: 'email',
    title: 'Appointment reminder',
    message: 'Video consultation starts in 25 minutes. Tap to join.',
    timestamp: '20 min ago',
  },
  {
    id: 'N3',
    channel: 'sms',
    title: 'Payment successful',
    message: 'Stripe payment of $220 confirmed for case SO-1204.',
    timestamp: 'Yesterday',
  },
];

export const timelineEvents = [
  {
    date: 'May 10',
    title: 'Initial symptom voice note uploaded',
    detail: 'AI extracted 12 key symptoms and generated translated summary.',
  },
  {
    date: 'May 12',
    title: 'MRI and lab reports processed',
    detail: 'OCR extracted 184 entities and built a chronological case timeline.',
  },
  {
    date: 'May 16',
    title: 'Urgent second opinion request sent',
    detail: 'Matched with top 3 cardiologists based on profile and outcomes.',
  },
  {
    date: 'May 20',
    title: 'Doctor opinion and prescription delivered',
    detail: 'Follow-up slot suggested with medication adherence reminders.',
  },
];

import type { Patient } from '../../../types/patient';

export type LoginFilter = 'all' | 'active' | 'disabled' | 'none';

export type PatientLoginStatus = {
  label: string;
  color: 'green' | 'red' | 'gray';
  key: LoginFilter;
};

export type PatientAnalytics = {
  total: number;
  activeLogins: number;
  disabledAccounts: number;
  countriesCount: number;
};

export type PatientQuickFilters = {
  country: string | null;
  city: string | null;
  bloodGroup: string | null;
  login: LoginFilter;
};

const BLOOD_GROUP_PALETTE = ['cyan', 'blue', 'teal', 'grape', 'violet', 'pink', 'orange'] as const;

export function patientInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function loginStatusForPatient(patient: {
  auth_user_id?: string | null;
  login_disabled?: boolean;
}): PatientLoginStatus {
  if (!patient.auth_user_id) {
    return { label: 'No Login', color: 'gray', key: 'none' };
  }
  if (patient.login_disabled) {
    return { label: 'Disabled', color: 'red', key: 'disabled' };
  }
  return { label: 'Active', color: 'green', key: 'active' };
}

export function bloodGroupBadgeColor(bloodGroup: string) {
  let hash = 0;
  for (let i = 0; i < bloodGroup.length; i += 1) {
    hash = bloodGroup.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BLOOD_GROUP_PALETTE[Math.abs(hash) % BLOOD_GROUP_PALETTE.length];
}

export function computePatientAnalytics(patients: Patient[]): PatientAnalytics {
  return {
    total: patients.length,
    activeLogins: patients.filter((p) => p.auth_user_id && !p.login_disabled).length,
    disabledAccounts: patients.filter((p) => p.auth_user_id && p.login_disabled).length,
    countriesCount: new Set(patients.map((p) => p.country).filter(Boolean)).size
  };
}

export function uniqueSorted(values: (string | null | undefined)[]) {
  return [...new Set(values.map((v) => v?.trim()).filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b)
  );
}

export function patientLocation(patient: Patient) {
  return [patient.city, patient.country].filter(Boolean).join(', ') || '—';
}

export function applyPatientQuickFilters(patients: Patient[], filters: PatientQuickFilters) {
  return patients.filter((patient) => {
    if (filters.country && patient.country !== filters.country) return false;
    if (filters.city && patient.city !== filters.city) return false;
    if (filters.bloodGroup && patient.blood_group !== filters.bloodGroup) return false;
    if (filters.login !== 'all') {
      const status = loginStatusForPatient(patient);
      if (status.key !== filters.login) return false;
    }
    return true;
  });
}

export function exportPatientsCsv(patients: Patient[]) {
  const headers = [
    'ElixClinix ID',
    'Full name',
    'Email',
    'Phone',
    'City',
    'Country',
    'Blood group',
    'Gender',
    'Joined',
    'Login status'
  ];

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

  const rows = patients.map((patient) => {
    const login = loginStatusForPatient(patient).label;
    return [
      patient.elix_id,
      patient.full_name,
      patient.email,
      patient.phone ?? '',
      patient.city ?? '',
      patient.country ?? '',
      patient.blood_group ?? '',
      patient.gender ?? '',
      patient.created_at ? new Date(patient.created_at).toLocaleDateString() : '',
      login
    ]
      .map(escape)
      .join(',');
  });

  const csv = [headers.map(escape).join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `elix-patients-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

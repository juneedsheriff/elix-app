import { formatConsultationFeeUsd } from '../../../lib/doctors';
import type { Doctor } from '../../../types/doctor';

export type LoginFilter = 'all' | 'active' | 'disabled' | 'none';

export type DoctorLoginStatus = {
  label: string;
  color: 'green' | 'red' | 'gray';
  key: LoginFilter;
};

export type DoctorAnalytics = {
  total: number;
  activeLogins: number;
  disabledAccounts: number;
  specialtiesCount: number;
};

export type DoctorQuickFilters = {
  specialty: string | null;
  country: string | null;
  login: LoginFilter;
};

const SPECIALTY_PALETTE = ['cyan', 'blue', 'teal', 'green', 'violet', 'grape', 'indigo'] as const;

export function doctorInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function loginStatusForDoctor(doctor: {
  auth_user_id?: string | null;
  login_disabled?: boolean;
}): DoctorLoginStatus {
  if (!doctor.auth_user_id) {
    return { label: 'No Login', color: 'gray', key: 'none' };
  }
  if (doctor.login_disabled) {
    return { label: 'Disabled', color: 'red', key: 'disabled' };
  }
  return { label: 'Active', color: 'green', key: 'active' };
}

export function specialtyBadgeColor(specialty: string) {
  let hash = 0;
  for (let i = 0; i < specialty.length; i += 1) {
    hash = specialty.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SPECIALTY_PALETTE[Math.abs(hash) % SPECIALTY_PALETTE.length];
}

export function computeDoctorAnalytics(doctors: Doctor[]): DoctorAnalytics {
  return {
    total: doctors.length,
    activeLogins: doctors.filter((d) => d.auth_user_id && !d.login_disabled).length,
    disabledAccounts: doctors.filter((d) => d.auth_user_id && d.login_disabled).length,
    specialtiesCount: new Set(doctors.map((d) => d.specialty).filter(Boolean)).size
  };
}

export function uniqueSorted(values: (string | null | undefined)[]) {
  return [...new Set(values.map((v) => v?.trim()).filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b)
  );
}

export function doctorCountry(doctor: Doctor) {
  return doctor.clinic_country ?? doctor.country ?? '';
}

export function doctorClinicName(doctor: Doctor) {
  return doctor.clinic_name ?? doctor.hospital ?? '';
}

export function doctorMobile(doctor: Doctor) {
  return doctor.mobile_no ?? doctor.phone ?? '';
}

export function applyDoctorQuickFilters(doctors: Doctor[], filters: DoctorQuickFilters) {
  return doctors.filter((doctor) => {
    if (filters.specialty && doctor.specialty !== filters.specialty) return false;
    if (filters.country && doctorCountry(doctor) !== filters.country) return false;
    if (filters.login !== 'all') {
      const status = loginStatusForDoctor(doctor);
      if (status.key !== filters.login) return false;
    }
    return true;
  });
}

export function exportDoctorsCsv(doctors: Doctor[]) {
  const headers = [
    'Full name',
    'Email',
    'Gender',
    'Mobile',
    'Specialty',
    'Clinic',
    'City',
    'Country',
    'Fee',
    'Login status'
  ];

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

  const rows = doctors.map((doctor) => {
    const login = loginStatusForDoctor(doctor).label;
    return [
      doctor.full_name,
      doctor.email,
      doctor.gender ?? '',
      doctorMobile(doctor),
      doctor.specialty,
      doctorClinicName(doctor),
      doctor.clinic_city ?? '',
      doctorCountry(doctor),
      formatConsultationFeeUsd(doctor.consultation_fee ?? doctor.fee_usd),
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
  link.download = `elix-doctors-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

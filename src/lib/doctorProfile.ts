import type {
  AdminDoctorUpdateInput,
  ConsultationHours,
  ConsultationHoursDay,
  ConsultationTier,
  Doctor,
  TimeSettings
} from '../types/doctor';
import { normalizeConsultationCurrency } from './consultationCurrency';
import {
  defaultConsultationTiers,
  normalizeConsultationTiersInput,
  parseConsultationTiers,
  preferredDurationTiers,
  primaryConsultationFeeFromTiers
} from './consultationTiers';

export const DOCTOR_PROFILE_COLUMNS = [
  'id',
  'full_name',
  'gender',
  'mobile_no',
  'email',
  'medical_license_no',
  'qualification',
  'start_of_practice',
  'specialty',
  'specialization',
  'about_doctor',
  'work_experience',
  'awards_recognitions',
  'membership',
  'clinic_name',
  'clinic_specialization',
  'about_clinic',
  'clinic_website',
  'clinic_country',
  'clinic_state',
  'clinic_city',
  'clinic_location',
  'clinic_street',
  'clinic_zipcode',
  'scheduler_effect_from',
  'scheduler_time_interval',
  'consultation_fee',
  'consultation_tiers',
  'consultation_currency',
  'elix_patient_priority',
  'scheduler_color',
  'consultation_hours',
  'time_settings',
  'phone',
  'years_experience',
  'hospital',
  'rating',
  'languages',
  'fee_usd',
  'image_url',
  'country',
  'bio',
  'is_visible',
  'deleted_at',
  'auth_user_id',
  'login_disabled',
  'created_at',
  'clinic_id'
].join(', ');

const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
] as const;

const DEFAULT_DAY: ConsultationHoursDay = { enabled: false, start: '09:00', end: '17:00' };

export const DEFAULT_CONSULTATION_HOURS: ConsultationHours = {
  monday: { ...DEFAULT_DAY, enabled: true },
  tuesday: { ...DEFAULT_DAY, enabled: true },
  wednesday: { ...DEFAULT_DAY, enabled: true },
  thursday: { ...DEFAULT_DAY, enabled: true },
  friday: { ...DEFAULT_DAY, enabled: true },
  saturday: { ...DEFAULT_DAY },
  sunday: { ...DEFAULT_DAY }
};

export function defaultConsultationHours(): ConsultationHours {
  return JSON.parse(JSON.stringify(DEFAULT_CONSULTATION_HOURS)) as ConsultationHours;
}

export const DEFAULT_DOCTOR_IMAGE_PLACEHOLDER = 'https://placehold.co/400x400?text=Doctor';

export function emptyAdminDoctorInput(): AdminDoctorUpdateInput {
  return {
    full_name: '',
    gender: null,
    mobile_no: '',
    email: '',
    medical_license_no: null,
    qualification: null,
    start_of_practice: null,
    specialty: '',
    specialization: null,
    about_doctor: null,
    work_experience: null,
    awards_recognitions: null,
    membership: null,
    clinic_name: '',
    clinic_specialization: null,
    about_clinic: null,
    clinic_website: null,
    clinic_country: '',
    clinic_state: null,
    clinic_city: null,
    clinic_location: null,
    clinic_street: null,
    clinic_zipcode: null,
    scheduler_effect_from: null,
    scheduler_time_interval: 30,
    consultation_fee: 0,
    consultation_tiers: preferredDurationTiers(),
    consultation_currency: 'USD',
    elix_patient_priority: false,
    scheduler_color: '#09abc0',
    consultation_hours: defaultConsultationHours(),
    time_settings: {},
    years_experience: 0,
    rating: 4.5,
    languages: '',
    image_url: DEFAULT_DOCTOR_IMAGE_PLACEHOLDER
  };
}

export function validateAdminDoctorInput(input: AdminDoctorUpdateInput): string | null {
  if (!input.full_name.trim()) return 'Enter the doctor’s full name.';
  if (!input.email.trim()) return 'Enter an email address.';
  if (!input.medical_license_no?.trim()) return 'Enter a medical license number.';
  if (!input.qualification?.trim()) return 'Enter a qualification.';
  if (!input.specialty.trim()) return 'Select a specialty.';
  if (!input.languages.trim()) return 'Select at least one language.';
  if (!input.gender?.trim()) return 'Select a gender.';
  const image = input.image_url.trim();
  if (!image) return 'Add a profile photo (URL or upload).';
  if (image.startsWith('data:image/')) {
    if (image.length > 700_000) return 'Uploaded image is too large. Use a smaller file (max 512 KB).';
    return null;
  }
  if (!/^https?:\/\//i.test(image)) return 'Profile photo must be a valid http(s) URL or an uploaded image.';
  return null;
}

function parseIntervals(raw: unknown): ConsultationHoursInterval[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const intervals = raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      start: typeof item.start === 'string' ? item.start : '09:00',
      end: typeof item.end === 'string' ? item.end : '17:00'
    }))
    .filter((item) => item.start && item.end);
  return intervals.length ? intervals : undefined;
}

function parseDay(raw: unknown): ConsultationHoursDay {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_DAY };
  const d = raw as Record<string, unknown>;
  const enabled = Boolean(d.enabled);
  const start = typeof d.start === 'string' ? d.start : '09:00';
  const end = typeof d.end === 'string' ? d.end : '17:00';
  const intervals = parseIntervals(d.intervals);
  return {
    enabled,
    start: intervals?.[0]?.start ?? start,
    end: intervals?.[0]?.end ?? end,
    intervals: intervals ?? (start && end ? [{ start, end }] : undefined)
  };
}

export function parseConsultationHours(raw: unknown): ConsultationHours {
  const base = defaultConsultationHours();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;
  for (const day of WEEKDAYS) {
    if (obj[day]) base[day] = parseDay(obj[day]);
  }
  return base;
}

export function parseTimeSettings(raw: unknown): TimeSettings {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  return {
    notes: typeof o.notes === 'string' ? o.notes : undefined,
    buffer_minutes: typeof o.buffer_minutes === 'number' ? o.buffer_minutes : Number(o.buffer_minutes) || undefined,
    lunch_break_start: typeof o.lunch_break_start === 'string' ? o.lunch_break_start : undefined,
    lunch_break_end: typeof o.lunch_break_end === 'string' ? o.lunch_break_end : undefined
  };
}

export function yearsFromStartOfPractice(start: string | null | undefined): number {
  if (!start) return 0;
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return 0;
  const years = new Date().getFullYear() - d.getFullYear();
  return Math.max(0, years);
}

export function normalizeDoctorProfile(row: Doctor): Doctor {
  const mobile = row.mobile_no?.trim() || row.phone?.trim() || '';
  const clinic = row.clinic_name?.trim() || row.hospital?.trim() || '';
  const clinicCountry = row.clinic_country?.trim() || row.country?.trim() || '';
  const about = row.about_doctor ?? row.bio;
  const fee = row.consultation_fee ?? row.fee_usd;
  const consultationTiers = parseConsultationTiers(row.consultation_tiers, Number(fee ?? 0));

  return {
    ...row,
    gender: row.gender ?? null,
    mobile_no: mobile || null,
    phone: mobile,
    medical_license_no: row.medical_license_no ?? null,
    qualification: row.qualification ?? null,
    start_of_practice: row.start_of_practice ?? null,
    specialization: row.specialization ?? row.specialty ?? null,
    about_doctor: about,
    bio: about,
    work_experience: row.work_experience ?? null,
    awards_recognitions: row.awards_recognitions ?? null,
    membership: row.membership ?? null,
    clinic_name: clinic || null,
    hospital: clinic,
    clinic_specialization: row.clinic_specialization ?? null,
    about_clinic: row.about_clinic ?? null,
    clinic_website: row.clinic_website ?? null,
    clinic_country: clinicCountry || null,
    country: clinicCountry,
    clinic_state: row.clinic_state ?? null,
    clinic_city: row.clinic_city ?? null,
    clinic_location: row.clinic_location ?? null,
    clinic_street: row.clinic_street ?? null,
    clinic_zipcode: row.clinic_zipcode ?? null,
    scheduler_effect_from: row.scheduler_effect_from ?? null,
    scheduler_time_interval:
      row.scheduler_time_interval != null ? Number(row.scheduler_time_interval) : null,
    consultation_fee: fee != null ? Number(fee) : primaryConsultationFeeFromTiers(consultationTiers),
    consultation_tiers: consultationTiers,
    consultation_currency: normalizeConsultationCurrency(row.consultation_currency),
    fee_usd: Number(fee ?? primaryConsultationFeeFromTiers(consultationTiers)),
    elix_patient_priority: Boolean(row.elix_patient_priority),
    login_disabled: Boolean(row.login_disabled),
    scheduler_color: row.scheduler_color?.trim() || '#09abc0',
    consultation_hours: parseConsultationHours(row.consultation_hours),
    time_settings: parseTimeSettings(row.time_settings),
    years_experience: Number(row.years_experience) || yearsFromStartOfPractice(row.start_of_practice),
    rating: Number(row.rating),
    languages: row.languages ?? '',
    image_url: row.image_url ?? '',
    is_visible: row.is_visible !== false,
    deleted_at: row.deleted_at ?? null,
    email: row.email ?? ''
  };
}

export function doctorToAdminInput(doctor: Doctor): AdminDoctorUpdateInput {
  return {
    full_name: doctor.full_name,
    gender: doctor.gender,
    mobile_no: doctor.mobile_no ?? doctor.phone ?? '',
    email: doctor.email,
    medical_license_no: doctor.medical_license_no,
    qualification: doctor.qualification,
    start_of_practice: doctor.start_of_practice,
    specialty: doctor.specialty,
    specialization: doctor.specialization,
    about_doctor: doctor.about_doctor,
    work_experience: doctor.work_experience,
    awards_recognitions: doctor.awards_recognitions,
    membership: doctor.membership,
    clinic_name: doctor.clinic_name ?? doctor.hospital,
    clinic_specialization: doctor.clinic_specialization,
    about_clinic: doctor.about_clinic,
    clinic_website: doctor.clinic_website,
    clinic_country: doctor.clinic_country ?? doctor.country,
    clinic_state: doctor.clinic_state,
    clinic_city: doctor.clinic_city,
    clinic_location: doctor.clinic_location,
    clinic_street: doctor.clinic_street,
    clinic_zipcode: doctor.clinic_zipcode,
    scheduler_effect_from: doctor.scheduler_effect_from,
    scheduler_time_interval: doctor.scheduler_time_interval,
    consultation_fee: doctor.consultation_fee ?? doctor.fee_usd ?? 0,
    consultation_tiers: doctor.consultation_tiers ?? defaultConsultationTiers(doctor.consultation_fee ?? doctor.fee_usd ?? 0),
    consultation_currency: normalizeConsultationCurrency(doctor.consultation_currency),
    elix_patient_priority: doctor.elix_patient_priority,
    scheduler_color: doctor.scheduler_color ?? '#09abc0',
    consultation_hours: doctor.consultation_hours,
    time_settings: doctor.time_settings,
    years_experience: doctor.years_experience,
    rating: doctor.rating,
    languages: doctor.languages,
    image_url: doctor.image_url
  };
}

export function adminInputToDbRow(input: AdminDoctorUpdateInput) {
  const years =
    input.start_of_practice != null && input.start_of_practice !== ''
      ? yearsFromStartOfPractice(input.start_of_practice)
      : Math.max(0, Math.round(input.years_experience));

  const mobile = input.mobile_no.trim();
  const clinic = input.clinic_name.trim();
  const country = input.clinic_country.trim();
  const about = input.about_doctor?.trim() || null;
  const tiers = normalizeConsultationTiersInput(
    input.consultation_tiers?.length
      ? input.consultation_tiers
      : defaultConsultationTiers(input.consultation_fee)
  );
  const fee = Math.max(0, Math.round(primaryConsultationFeeFromTiers(tiers) || input.consultation_fee));

  return {
    full_name: input.full_name.trim(),
    gender: input.gender?.trim() || null,
    mobile_no: mobile,
    phone: mobile,
    email: input.email.trim(),
    medical_license_no: input.medical_license_no?.trim() || null,
    qualification: input.qualification?.trim() || null,
    start_of_practice: input.start_of_practice || null,
    specialty: input.specialty.trim(),
    specialization: input.specialization?.trim() || null,
    about_doctor: about,
    bio: about,
    work_experience: input.work_experience?.trim() || null,
    awards_recognitions: input.awards_recognitions?.trim() || null,
    membership: input.membership?.trim() || null,
    clinic_name: clinic,
    hospital: clinic,
    clinic_specialization: input.clinic_specialization?.trim() || null,
    about_clinic: input.about_clinic?.trim() || null,
    clinic_website: input.clinic_website?.trim() || null,
    clinic_country: country,
    country,
    clinic_state: input.clinic_state?.trim() || null,
    clinic_city: input.clinic_city?.trim() || null,
    clinic_location: input.clinic_location?.trim() || null,
    clinic_street: input.clinic_street?.trim() || null,
    clinic_zipcode: input.clinic_zipcode?.trim() || null,
    scheduler_effect_from: input.scheduler_effect_from || null,
    scheduler_time_interval:
      input.scheduler_time_interval != null ? Math.round(input.scheduler_time_interval) : null,
    consultation_fee: fee,
    consultation_tiers: tiers,
    consultation_currency: normalizeConsultationCurrency(input.consultation_currency),
    fee_usd: fee,
    elix_patient_priority: input.elix_patient_priority,
    scheduler_color: input.scheduler_color.trim() || '#09abc0',
    consultation_hours: input.consultation_hours,
    time_settings: input.time_settings,
    years_experience: years,
    rating: Math.min(5, Math.max(0, Number(input.rating))),
    languages: input.languages.trim(),
    image_url: input.image_url.trim()
  };
}

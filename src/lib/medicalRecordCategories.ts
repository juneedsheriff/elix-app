export const MEDICAL_RECORD_CATEGORIES = [
  { id: 'doctors_notes', label: "Doctor's Notes" },
  { id: 'consultation_summary', label: 'Consultation Summary', patientUpload: false },
  { id: 'medical_reports', label: 'Medical Reports' },
  { id: 'lab_results', label: 'Lab Results' },
  {
    id: 'imaging_reports',
    label: 'Imaging Reports (X-ray, CT, MRI, PET, Ultrasound)'
  },
  { id: 'discharge_summary', label: 'Discharge Summary' },
  { id: 'prescriptions', label: 'Prescription(s)' },
  { id: 'pathology_biopsy', label: 'Pathology/Biopsy Reports' },
  { id: 'other_supporting', label: 'Other Supporting Documents' },
  { id: 'dicom_file', label: 'DICOM file', externalOnly: true }
] as const;

export type MedicalRecordCategoryId = (typeof MEDICAL_RECORD_CATEGORIES)[number]['id'];

export const DEFAULT_MEDICAL_RECORD_CATEGORY: MedicalRecordCategoryId = 'other_supporting';

const categoryLabelMap = new Map(
  MEDICAL_RECORD_CATEGORIES.map((category) => [category.id, category.label])
);

export function medicalRecordCategoryLabel(
  categoryId: string | null | undefined
): string {
  if (!categoryId) return categoryLabelMap.get('other_supporting') ?? 'Other Supporting Documents';
  return categoryLabelMap.get(categoryId as MedicalRecordCategoryId) ?? categoryId;
}

export function isExternalOnlyCategory(categoryId: MedicalRecordCategoryId): boolean {
  return categoryId === 'dicom_file';
}

/** Categories a patient can pick when uploading (excludes doctor/system-generated types). */
export function medicalRecordCategoriesForPatientUpload() {
  return MEDICAL_RECORD_CATEGORIES.filter(
    (category) => !('patientUpload' in category && category.patientUpload === false)
  );
}

export function isGoogleDriveShareUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'drive.google.com' || host.endsWith('.google.com') && parsed.pathname.includes('/drive');
  } catch {
    return false;
  }
}

/** Categories shown as view filters (all including DICOM). */
export const MEDICAL_RECORD_VIEW_FILTERS = [
  { id: 'all' as const, label: 'All records' },
  ...MEDICAL_RECORD_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label
  }))
];

export type MedicalRecordViewFilterId = (typeof MEDICAL_RECORD_VIEW_FILTERS)[number]['id'];

/** Resolve stored category for a vault record (falls back for legacy rows). */
export function medicalRecordCategoryId(
  record: { record_category?: string | null; external_url?: string | null; storage_path?: string | null }
): MedicalRecordCategoryId {
  const raw = record.record_category;
  if (raw && MEDICAL_RECORD_CATEGORIES.some((category) => category.id === raw)) {
    return raw as MedicalRecordCategoryId;
  }
  if (record.storage_path?.startsWith('consultation-summaries/')) return 'consultation_summary';
  if (record.external_url?.trim()) return 'dicom_file';
  return DEFAULT_MEDICAL_RECORD_CATEGORY;
}

export function isConsultationSummaryRecord(record: {
  id?: string | null;
  record_category?: string | null;
  storage_path?: string | null;
}): boolean {
  return medicalRecordCategoryId(record) === 'consultation_summary';
}

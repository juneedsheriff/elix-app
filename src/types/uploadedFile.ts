/** Row in public.uploaded_files — file bytes live in Cloudflare R2. */
export type UploadedFile = {
  id: string;
  user_id: string | null;
  patient_id?: string | null;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  storage_bucket: string;
  storage_path: string;
  summary: string | null;
  uploaded_at: string;
  record_category?: string | null;
  external_url?: string | null;
};

/** Alias used by opinion-request flows */
export type MedicalRecord = UploadedFile & {
  patient_id: string | null;
  file_type: string;
};

export function toMedicalRecord(row: UploadedFile): MedicalRecord {
  return {
    ...row,
    patient_id: row.user_id,
    file_type: row.mime_type
  };
}

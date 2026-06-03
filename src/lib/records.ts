import type { MedicalRecord, UploadedFile } from '../types/uploadedFile';
import { toMedicalRecord } from '../types/uploadedFile';
import { fetchPatientByAuthUserId } from './patients';
import {
  createR2UploadUrl,
  deleteR2Object,
  downloadMedicalRecordBlob,
  isR2StorageConfigured,
  uploadFileToR2,
  type MedicalRecordDownloadOptions
} from './r2Storage';
import { supabase } from './supabase';

/** Cloudflare R2 bucket name (metadata column + worker binding). */
const BUCKET = 'medical-records';
const TABLE = 'uploaded_files';
const MAX_BYTES = 10 * 1024 * 1024;

const fileColumns =
  'id, user_id, patient_id, file_name, mime_type, file_size_bytes, storage_bucket, storage_path, summary, uploaded_at';

const EXTENSION_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

const ALLOWED_EXTENSIONS = new Set(Object.keys(EXTENSION_MIME));

export function isAllowedMedicalFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.has(ext)) return false;
  if (file.size > MAX_BYTES) return false;
  return true;
}

export function medicalFileValidationError(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return `"${file.name}" is not supported. Use PDF, JPG, or DOC/DOCX.`;
  }
  if (file.size > MAX_BYTES) {
    return `"${file.name}" exceeds the 10 MB limit.`;
  }
  return null;
}

function mimeForFile(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return file.type || EXTENSION_MIME[ext] || 'application/octet-stream';
}

function normalizeRow(row: UploadedFile): UploadedFile {
  return {
    ...row,
    file_size_bytes: Number(row.file_size_bytes)
  };
}

function asMedicalRecords(rows: UploadedFile[] | null): MedicalRecord[] {
  return (rows ?? []).map((row) => toMedicalRecord(normalizeRow(row)));
}

/** Demo / shared pool only (user_id is null). Prefer fetchUserMedicalRecords for a signed-in patient. */
export async function fetchMedicalRecords(patientId: string | null) {
  let query = supabase.from(TABLE).select(fileColumns).order('uploaded_at', { ascending: false });

  if (patientId) {
    query = query.eq('user_id', patientId);
  } else {
    query = query.is('user_id', null);
  }

  const result = await query.returns<UploadedFile[]>();
  if (result.error) return { data: null, error: result.error };
  return { data: asMedicalRecords(result.data), error: null };
}

/** Records uploaded by the signed-in user (auth user id). */
export async function fetchUserMedicalRecords(authUserId: string) {
  const result = await supabase
    .from(TABLE)
    .select(fileColumns)
    .eq('user_id', authUserId)
    .order('uploaded_at', { ascending: false })
    .returns<UploadedFile[]>();

  if (result.error) return { data: null, error: result.error };
  return { data: asMedicalRecords(result.data), error: null };
}

export { isR2StorageConfigured };

export async function uploadMedicalRecord(file: File, patientId: string) {
  const validationError = medicalFileValidationError(file);
  if (validationError) {
    return { data: null, error: { message: validationError } };
  }

  if (!isR2StorageConfigured()) {
    return {
      data: null,
      error: { message: 'Cloudflare R2 is not configured. Set VITE_R2_API_URL in .env.local.' }
    };
  }

  const contentType = mimeForFile(file);

  const { data: uploadTarget, error: presignError } = await createR2UploadUrl(file);
  if (presignError || !uploadTarget) {
    return { data: null, error: presignError ?? { message: 'Could not prepare upload.' } };
  }

  const { error: uploadError } = await uploadFileToR2(
    uploadTarget.uploadUrl,
    file,
    contentType,
    uploadTarget.storagePath
  );
  if (uploadError) {
    return { data: null, error: uploadError };
  }

  const { data: patientRow } = await fetchPatientByAuthUserId(patientId);

  const { data, error: rowError } = await supabase
    .from(TABLE)
    .insert({
      user_id: patientId,
      patient_id: patientRow?.id ?? null,
      file_name: file.name,
      mime_type: contentType,
      file_size_bytes: file.size,
      storage_bucket: uploadTarget.storageBucket || BUCKET,
      storage_path: uploadTarget.storagePath,
      summary: 'Uploaded just now'
    })
    .select(fileColumns)
    .single<UploadedFile>();

  if (rowError) {
    await deleteR2Object(uploadTarget.storagePath);
    return { data: null, error: rowError };
  }

  return { data: toMedicalRecord(normalizeRow(data)), error: null };
}

export async function getMedicalRecordDownloadUrl(
  storagePath: string,
  options?: MedicalRecordDownloadOptions
) {
  const { blob, error } = await downloadMedicalRecordBlob(storagePath, options);
  if (error || !blob) return { data: null, error };
  const signedUrl = URL.createObjectURL(blob);
  return { data: { signedUrl }, error: null };
}

export async function deleteMedicalRecord(record: MedicalRecord) {
  if (record.storage_path) {
    const { error: storageError } = await deleteR2Object(record.storage_path);
    if (storageError) return { error: storageError };
  }

  return supabase.from(TABLE).delete().eq('id', record.id);
}

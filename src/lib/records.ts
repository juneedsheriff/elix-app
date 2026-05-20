import type { MedicalRecord, UploadedFile } from '../types/uploadedFile';
import { toMedicalRecord } from '../types/uploadedFile';
import { fetchPatientByAuthUserId } from './patients';
import { supabase } from './supabase';

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

function storagePathFor(userId: string, fileName: string): string {
  const safeName = fileName.replace(/[^\w.\-() ]+/g, '_');
  return `${userId}/${crypto.randomUUID()}-${safeName}`;
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

export async function uploadMedicalRecord(file: File, patientId: string) {
  const validationError = medicalFileValidationError(file);
  if (validationError) {
    return { data: null, error: { message: validationError } };
  }

  const storagePath = storagePathFor(patientId, file.name);
  const contentType = mimeForFile(file);

  const { error: storageError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    contentType,
    upsert: false
  });

  if (storageError) {
    return { data: null, error: storageError };
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
      storage_bucket: BUCKET,
      storage_path: storagePath,
      summary: 'Uploaded just now'
    })
    .select(fileColumns)
    .single<UploadedFile>();

  if (rowError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { data: null, error: rowError };
  }

  return { data: toMedicalRecord(normalizeRow(data)), error: null };
}

export async function getMedicalRecordDownloadUrl(storagePath: string, expiresIn = 3600) {
  return supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn);
}

export async function deleteMedicalRecord(record: MedicalRecord) {
  if (record.storage_path) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([record.storage_path]);
    if (storageError) return { error: storageError };
  }

  return supabase.from(TABLE).delete().eq('id', record.id);
}

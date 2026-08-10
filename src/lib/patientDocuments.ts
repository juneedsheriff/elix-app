import type { PatientAttachedDocument } from '../types/patient';

export function parsePatientAttachedDocuments(raw: unknown): PatientAttachedDocument[] {
  if (!raw) return [];
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const storagePath = typeof row.storage_path === 'string' ? row.storage_path.trim() : '';
      const fileName = typeof row.file_name === 'string' ? row.file_name.trim() : '';
      if (!storagePath || !fileName) return null;
      return {
        id:
          typeof row.id === 'string' && row.id.trim()
            ? row.id.trim()
            : crypto.randomUUID(),
        storage_path: storagePath,
        file_name: fileName,
        mime_type: typeof row.mime_type === 'string' ? row.mime_type : null,
        uploaded_at:
          typeof row.uploaded_at === 'string' && row.uploaded_at.trim()
            ? row.uploaded_at
            : new Date().toISOString()
      } satisfies PatientAttachedDocument;
    })
    .filter((item): item is PatientAttachedDocument => Boolean(item));
}

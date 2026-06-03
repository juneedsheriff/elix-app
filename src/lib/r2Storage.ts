import { supabase } from './supabase';

const apiBase = import.meta.env.VITE_R2_API_URL?.replace(/\/$/, '') ?? '';

export function isR2StorageConfigured(): boolean {
  return Boolean(apiBase);
}

type R2ApiError = { message: string };

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function r2ApiRequest<T>(
  path: string,
  init: RequestInit & { json?: Record<string, unknown> }
): Promise<{ data: T | null; error: R2ApiError | null }> {
  if (!apiBase) {
    return {
      data: null,
      error: { message: 'Cloudflare R2 API is not configured. Set VITE_R2_API_URL in .env.local.' }
    };
  }

  const token = await getAccessToken();
  if (!token) {
    return { data: null, error: { message: 'Sign in to upload medical records.' } };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(init.json ? { 'Content-Type': 'application/json' } : {})
  };

  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
      body: init.json ? JSON.stringify(init.json) : init.body
    });
  } catch {
    return { data: null, error: { message: 'Could not reach the records storage API.' } };
  }

  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    return {
      data: null,
      error: { message: payload.error ?? `Storage API error (${response.status})` }
    };
  }

  return { data: payload as T, error: null };
}

export async function createR2UploadUrl(file: File) {
  return r2ApiRequest<{ uploadUrl: string; storagePath: string; storageBucket: string }>(
    '/v1/records/upload-url',
    {
      method: 'POST',
      json: {
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        contentLength: file.size
      }
    }
  );
}

export async function uploadFileToR2(
  uploadUrl: string,
  file: File,
  contentType: string,
  storagePath: string
) {
  const token = await getAccessToken();
  if (!token) {
    return { error: { message: 'Sign in to upload medical records.' } };
  }

  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
        'X-Storage-Path': storagePath
      }
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      return {
        error: { message: payload.error ?? `Upload to Cloudflare failed (${response.status}).` }
      };
    }

    return { error: null };
  } catch {
    return { error: { message: 'Upload to Cloudflare failed.' } };
  }
}

export type MedicalRecordDownloadOptions = {
  /** Opinion request id — required for staff/doctor/patient consultation PDFs and payment proof. */
  requestId?: string;
};

export async function createConsultationSummaryUploadUrl(requestId: string, contentLength: number) {
  return r2ApiRequest<{ uploadUrl: string; storagePath: string; storageBucket: string }>(
    '/v1/consultation-summary/upload-url',
    {
      method: 'POST',
      json: {
        requestId,
        contentLength
      }
    }
  );
}

export async function downloadMedicalRecordBlob(
  storagePath: string,
  options?: MedicalRecordDownloadOptions
) {
  if (!apiBase) {
    return {
      blob: null,
      error: { message: 'Cloudflare R2 API is not configured. Set VITE_R2_API_URL in .env.local.' }
    };
  }

  const token = await getAccessToken();
  if (!token) {
    return { blob: null, error: { message: 'Sign in to open medical records.' } };
  }

  try {
    const response = await fetch(`${apiBase}/v1/records/download`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        storagePath,
        ...(options?.requestId ? { requestId: options.requestId } : {})
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      return {
        blob: null,
        error: { message: payload.error ?? `Download failed (${response.status}).` }
      };
    }

    return { blob: await response.blob(), error: null };
  } catch {
    return { blob: null, error: { message: 'Could not download file from Cloudflare.' } };
  }
}

export async function deleteR2Object(storagePath: string) {
  return r2ApiRequest<{ ok: boolean }>('/v1/records/object', {
    method: 'DELETE',
    json: { storagePath }
  });
}

import { supabase } from './supabase';
import { ensureFreshAccessToken } from './supabaseSession';

const apiBase = import.meta.env.VITE_R2_API_URL?.replace(/\/$/, '') ?? '';

export function isR2StorageConfigured(): boolean {
  return Boolean(apiBase);
}

type R2ApiError = { message: string };

async function getAccessToken(): Promise<string | null> {
  return ensureFreshAccessToken();
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

  const run = async (forceRefresh: boolean) => {
    const token = forceRefresh
      ? await ensureFreshAccessToken({ forceRefresh: true })
      : await getAccessToken();
    if (!token) {
      return {
        data: null as T | null,
        error: { message: 'Sign in to upload medical records.' } as R2ApiError,
        response: null as Response | null
      };
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      ...(init.json ? { 'Content-Type': 'application/json' } : {})
    };

    try {
      const response = await fetch(`${apiBase}${path}`, {
        ...init,
        headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
        body: init.json ? JSON.stringify(init.json) : init.body
      });
      return { data: null as T | null, error: null as R2ApiError | null, response };
    } catch {
      return {
        data: null as T | null,
        error: { message: 'Could not reach the records storage API.' },
        response: null as Response | null
      };
    }
  };

  let result = await run(false);
  if (result.error && !result.response) {
    return { data: null, error: result.error };
  }

  if (result.response?.status === 401) {
    result = await run(true);
    if (result.error && !result.response) {
      return { data: null, error: result.error };
    }
  }

  const response = result.response;
  if (!response) {
    return { data: null, error: { message: 'Could not reach the records storage API.' } };
  }

  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    hint?: string;
  };

  if (!response.ok) {
    const detail = [payload.error, payload.hint].filter(Boolean).join(' — ');
    return {
      data: null,
      error: {
        message: detail || `Storage API error (${response.status}).`
      }
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
  const putOnce = async (forceRefresh: boolean) => {
    const token = forceRefresh
      ? await ensureFreshAccessToken({ forceRefresh: true })
      : await getAccessToken();
    if (!token) {
      return { error: { message: 'Sign in to upload medical records.' } as R2ApiError, status: 0 };
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
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          hint?: string;
        };
        const detail = [payload.error, payload.hint].filter(Boolean).join(' — ');
        return {
          error: {
            message: detail || `Upload to Cloudflare failed (${response.status}).`
          } as R2ApiError,
          status: response.status
        };
      }

      return { error: null as R2ApiError | null, status: response.status };
    } catch {
      return { error: { message: 'Upload to Cloudflare failed.' } as R2ApiError, status: 0 };
    }
  };

  let result = await putOnce(false);
  if (result.status === 401) {
    result = await putOnce(true);
  }
  return { error: result.error };
}

export type MedicalRecordDownloadOptions = {
  /** Opinion request id — required for staff/doctor/patient consultation PDFs and payment proof. */
  requestId?: string;
};

export async function createConsultationInvoiceUploadUrl(requestId: string, contentLength: number) {
  return r2ApiRequest<{ uploadUrl: string; storagePath: string; storageBucket: string }>(
    '/v1/consultation-invoice/upload-url',
    {
      method: 'POST',
      json: {
        requestId,
        contentLength
      }
    }
  );
}

export async function createConsultationSummaryUploadUrl(
  requestId: string,
  contentLength: number,
  fileName: string,
  doctorId?: string | null
) {
  return r2ApiRequest<{ uploadUrl: string; storagePath: string; storageBucket: string }>(
    '/v1/consultation-summary/upload-url',
    {
      method: 'POST',
      json: {
        requestId,
        contentLength,
        fileName,
        ...(doctorId?.trim() ? { doctorId: doctorId.trim() } : {})
      }
    }
  );
}

export async function createConsultationOrderUploadUrl(
  requestId: string,
  contentLength: number,
  fileName: string,
  recordCategory: 'prescriptions' | 'lab_results'
) {
  return r2ApiRequest<{ uploadUrl: string; storagePath: string; storageBucket: string }>(
    '/v1/consultation-order/upload-url',
    {
      method: 'POST',
      json: {
        requestId,
        contentLength,
        fileName,
        recordCategory
      }
    }
  );
}

export async function registerConsultationOrderVaultRecord(input: {
  requestId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  recordCategory: 'prescriptions' | 'lab_results';
  summary: string;
}) {
  return r2ApiRequest<{ ok: boolean }>('/v1/consultation-order/register', {
    method: 'POST',
    json: input
  });
}

export async function fetchLatestConsultationOrderFile(
  requestId: string,
  recordCategory: 'prescriptions' | 'lab_results'
) {
  return r2ApiRequest<{ storagePath: string; fileName: string | null }>(
    '/v1/consultation-order/latest',
    {
      method: 'POST',
      json: { requestId, recordCategory }
    }
  );
}

export async function createRequestRecordUploadUrl(
  requestId: string,
  file: Pick<File, 'name' | 'type' | 'size'>
) {
  return r2ApiRequest<{ uploadUrl: string; storagePath: string; storageBucket: string }>(
    '/v1/request-records/upload-url',
    {
      method: 'POST',
      json: {
        requestId,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        contentLength: file.size
      }
    }
  );
}

export async function registerRequestRecord(input: {
  requestId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  recordCategory: string;
  summary: string;
}) {
  return r2ApiRequest<{ ok: boolean; recordId: string }>('/v1/request-records/register', {
    method: 'POST',
    json: input
  });
}

export async function deleteRequestRecord(input: { requestId: string; recordId: string }) {
  return r2ApiRequest<{ ok: boolean }>('/v1/request-records/delete', {
    method: 'POST',
    json: input
  });
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

  const downloadOnce = async (forceRefresh: boolean) => {
    const token = forceRefresh
      ? await ensureFreshAccessToken({ forceRefresh: true })
      : await getAccessToken();
    if (!token) {
      return { blob: null as Blob | null, error: { message: 'Sign in to open medical records.' }, status: 0 };
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
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          hint?: string;
        };
        const detail = [payload.error, payload.hint].filter(Boolean).join(' — ');
        return {
          blob: null as Blob | null,
          error: { message: detail || `Download failed (${response.status}).` },
          status: response.status
        };
      }

      return { blob: await response.blob(), error: null, status: response.status };
    } catch {
      return {
        blob: null as Blob | null,
        error: { message: 'Could not download file from Cloudflare.' },
        status: 0
      };
    }
  };

  let result = await downloadOnce(false);
  if (result.status === 401) {
    result = await downloadOnce(true);
  }
  return { blob: result.blob, error: result.error };
}

export async function deleteR2Object(storagePath: string) {
  return r2ApiRequest<{ ok: boolean }>('/v1/records/object', {
    method: 'DELETE',
    json: { storagePath }
  });
}

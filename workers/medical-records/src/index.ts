type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  R2_BUCKET_NAME: string;
  MEDICAL_RECORDS: R2Bucket;
  ALLOWED_ORIGIN?: string;
};

type AuthUser = { id: string };

function corsHeaders(origin: string | null, env: Env): HeadersInit {
  const allowed = env.ALLOWED_ORIGIN?.trim();
  const value = allowed && origin === allowed ? origin : allowed || '*';
  return {
    'Access-Control-Allow-Origin': value,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Storage-Path',
    'Access-Control-Max-Age': '86400'
  };
}

function jsonResponse(body: unknown, status: number, origin: string | null, env: Env): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin, env)
    }
  });
}

async function getAuthUser(request: Request, env: Env): Promise<AuthUser | null> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;

  const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      Authorization: auth,
      apikey: env.SUPABASE_ANON_KEY
    }
  });

  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return user.id ? { id: user.id } : null;
}

function assertOwnsPath(allowedPrefixes: string[], storagePath: string): void {
  if (storagePath.includes('..')) {
    throw new Error('Forbidden');
  }
  if (!allowedPrefixes.some((prefix) => storagePath.startsWith(prefix))) {
    throw new Error('Forbidden');
  }
}

function supabaseRestHeaders(authHeader: string, env: Env, useServiceRole = false) {
  const key = useServiceRole && env.SUPABASE_SERVICE_ROLE_KEY
    ? env.SUPABASE_SERVICE_ROLE_KEY
    : env.SUPABASE_ANON_KEY;
  return {
    Authorization: useServiceRole && env.SUPABASE_SERVICE_ROLE_KEY
      ? `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
      : authHeader,
    apikey: key,
    Accept: 'application/json'
  };
}

async function isStaffMember(userId: string, authHeader: string, env: Env): Promise<boolean> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return false;

  const base = env.SUPABASE_URL.replace(/\/$/, '');
  const url = `${base}/rest/v1/admins?auth_user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`;
  const res = await fetch(url, { headers: supabaseRestHeaders(authHeader, env) });
  if (!res.ok) return false;

  const rows = (await res.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

async function getDoctorIdForAuthUser(
  userId: string,
  authHeader: string,
  env: Env
): Promise<string | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;

  const base = env.SUPABASE_URL.replace(/\/$/, '');
  const url = `${base}/rest/v1/doctors?auth_user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`;
  const useServiceRole = Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
  const res = await fetch(url, {
    headers: supabaseRestHeaders(authHeader, env, useServiceRole)
  });
  if (!res.ok) return null;

  const rows = (await res.json()) as { id?: string }[];
  return rows[0]?.id ?? null;
}

async function canDoctorUploadConsultationSummary(
  userId: string,
  authHeader: string,
  requestId: string,
  storagePath: string,
  env: Env
): Promise<boolean> {
  const expectedPrefix = `consultation-summaries/${requestId.trim()}/`;
  if (!storagePath.startsWith(expectedPrefix)) return false;

  const doctorId = await getDoctorIdForAuthUser(userId, authHeader, env);
  if (!doctorId) return false;

  const base = env.SUPABASE_URL.replace(/\/$/, '');
  const url = `${base}/rest/v1/opinion_requests?id=eq.${encodeURIComponent(requestId.trim())}&doctor_id=eq.${encodeURIComponent(doctorId)}&select=id&limit=1`;
  const useServiceRole = Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
  const res = await fetch(url, {
    headers: supabaseRestHeaders(authHeader, env, useServiceRole)
  });
  if (!res.ok) return false;

  const rows = (await res.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

async function canAccessConsultationSummaryPdfForRequest(
  authHeader: string,
  userId: string,
  requestId: string,
  storagePath: string,
  env: Env
): Promise<boolean> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return false;

  const base = env.SUPABASE_URL.replace(/\/$/, '');
  const normalizedPath = storagePath.trim();
  const select = 'id,request_id,pdf_storage_path,patient_auth_user_id,doctor_id';

  const fetchSummary = async (useServiceRole: boolean) => {
    const url = `${base}/rest/v1/consultation_summaries?request_id=eq.${encodeURIComponent(requestId.trim())}&select=${select}&limit=1`;
    const res = await fetch(url, { headers: supabaseRestHeaders(authHeader, env, useServiceRole) });
    if (!res.ok) return null;
    const rows = (await res.json()) as {
      pdf_storage_path?: string | null;
      patient_auth_user_id?: string | null;
      doctor_id?: string | null;
    }[];
    return rows[0] ?? null;
  };

  let summary = await fetchSummary(false);
  const staff = await isStaffMember(userId, authHeader, env);

  if (!summary && staff && env.SUPABASE_SERVICE_ROLE_KEY) {
    summary = await fetchSummary(true);
    if (summary) {
      const visibleToStaff = await fetchSummary(false);
      if (!visibleToStaff) return false;
    }
  }

  if (!summary?.pdf_storage_path?.trim()) return false;
  if (summary.pdf_storage_path.trim() !== normalizedPath) return false;

  if (summary.patient_auth_user_id === userId) return true;
  if (staff) return true;

  const doctorId = await getDoctorIdForAuthUser(userId, authHeader, env);
  return Boolean(doctorId && summary.doctor_id === doctorId);
}

async function canStaffUploadConsultationInvoice(
  userId: string,
  authHeader: string,
  requestId: string,
  storagePath: string,
  env: Env
): Promise<boolean> {
  const expectedPrefix = `consultation-invoices/${requestId.trim()}/`;
  if (!storagePath.startsWith(expectedPrefix)) return false;

  const staff = await isStaffMember(userId, authHeader, env);
  if (!staff) return false;

  const base = env.SUPABASE_URL.replace(/\/$/, '');
  const url = `${base}/rest/v1/opinion_requests?id=eq.${encodeURIComponent(requestId.trim())}&select=id,assigned_to&limit=1`;
  const res = await fetch(url, { headers: supabaseRestHeaders(authHeader, env) });
  if (!res.ok) return false;

  const rows = (await res.json()) as { assigned_to?: string | null }[];
  const row = rows[0];
  if (!row) return false;

  if (!row.assigned_to) return true;

  const staffUrl = `${base}/rest/v1/admins?auth_user_id=eq.${encodeURIComponent(userId)}&select=id,role&limit=1`;
  const staffRes = await fetch(staffUrl, { headers: supabaseRestHeaders(authHeader, env) });
  if (!staffRes.ok) return false;
  const staffRows = (await staffRes.json()) as { id?: string; role?: string }[];
  const staffRow = staffRows[0];
  if (!staffRow?.id) return false;
  if (staffRow.role === 'administrator') return true;
  return row.assigned_to === staffRow.id;
}

async function canAccessConsultationInvoiceForRequest(
  authHeader: string,
  userId: string,
  requestId: string,
  storagePath: string,
  env: Env
): Promise<boolean> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return false;

  const base = env.SUPABASE_URL.replace(/\/$/, '');
  const normalizedPath = storagePath.trim();
  const select = 'id,invoice_pdf_storage_path,patient_id';

  const fetchRow = async (useServiceRole: boolean) => {
    const url = `${base}/rest/v1/opinion_requests?id=eq.${encodeURIComponent(requestId.trim())}&select=${select}&limit=1`;
    const res = await fetch(url, { headers: supabaseRestHeaders(authHeader, env, useServiceRole) });
    if (!res.ok) return null;
    const rows = (await res.json()) as {
      invoice_pdf_storage_path?: string | null;
      patient_id?: string | null;
    }[];
    return rows[0] ?? null;
  };

  let row = await fetchRow(false);
  const staff = await isStaffMember(userId, authHeader, env);

  if (!row && staff && env.SUPABASE_SERVICE_ROLE_KEY) {
    row = await fetchRow(true);
    if (row) {
      const visibleToStaff = await fetchRow(false);
      if (!visibleToStaff) return false;
    }
  }

  if (!row?.invoice_pdf_storage_path?.trim()) return false;
  if (row.invoice_pdf_storage_path.trim() !== normalizedPath) return false;
  if (row.patient_id === userId) return true;
  return staff;
}

async function canAccessPaymentProofForRequest(
  authHeader: string,
  userId: string,
  requestId: string,
  storagePath: string,
  env: Env
): Promise<boolean> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return false;

  const base = env.SUPABASE_URL.replace(/\/$/, '');
  const normalizedPath = storagePath.trim();
  const select = 'id,payment_proof_storage_path,patient_id';

  const fetchRow = async (useServiceRole: boolean) => {
    const url = `${base}/rest/v1/opinion_requests?id=eq.${encodeURIComponent(requestId)}&select=${select}&limit=1`;
    const res = await fetch(url, { headers: supabaseRestHeaders(authHeader, env, useServiceRole) });
    if (!res.ok) return null;
    const rows = (await res.json()) as {
      payment_proof_storage_path?: string | null;
      patient_id?: string | null;
    }[];
    return rows[0] ?? null;
  };

  let row = await fetchRow(false);
  const staff = await isStaffMember(userId, authHeader, env);

  if (!row && staff && env.SUPABASE_SERVICE_ROLE_KEY) {
    row = await fetchRow(true);
    if (row) {
      const visibleToStaff = await fetchRow(false);
      if (!visibleToStaff) return false;
    }
  }

  if (!row?.payment_proof_storage_path?.trim()) return false;
  if (row.payment_proof_storage_path.trim() !== normalizedPath) return false;
  if (row.patient_id === userId) return true;
  return staff;
}

async function canAccessStoragePathViaRls(
  authHeader: string,
  storagePath: string,
  env: Env
): Promise<boolean> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return false;

  const base = env.SUPABASE_URL.replace(/\/$/, '');
  const headers = supabaseRestHeaders(authHeader, env);

  const filesUrl = `${base}/rest/v1/uploaded_files?storage_path=eq.${encodeURIComponent(storagePath)}&select=id&limit=1`;
  const filesRes = await fetch(filesUrl, { headers });
  if (filesRes.ok) {
    const rows = (await filesRes.json()) as unknown[];
    if (Array.isArray(rows) && rows.length > 0) return true;
  }

  const proofUrl = `${base}/rest/v1/opinion_requests?payment_proof_storage_path=eq.${encodeURIComponent(storagePath)}&select=id&limit=1`;
  const proofRes = await fetch(proofUrl, { headers });
  if (proofRes.ok) {
    const proofRows = (await proofRes.json()) as unknown[];
    if (Array.isArray(proofRows) && proofRows.length > 0) return true;
  }

  const summaryUrl = `${base}/rest/v1/consultation_summaries?pdf_storage_path=eq.${encodeURIComponent(storagePath)}&select=id&limit=1`;
  const summaryRes = await fetch(summaryUrl, { headers });
  if (summaryRes.ok) {
    const summaryRows = (await summaryRes.json()) as unknown[];
    if (Array.isArray(summaryRows) && summaryRows.length > 0) return true;
  }

  const invoiceUrl = `${base}/rest/v1/opinion_requests?invoice_pdf_storage_path=eq.${encodeURIComponent(storagePath)}&select=id&limit=1`;
  const invoiceRes = await fetch(invoiceUrl, { headers });
  if (!invoiceRes.ok) return false;

  const invoiceRows = (await invoiceRes.json()) as unknown[];
  return Array.isArray(invoiceRows) && invoiceRows.length > 0;
}

async function assertCanAccessPath(
  allowedPrefixes: string[],
  authHeader: string,
  storagePath: string,
  env: Env,
  options?: { userId?: string; requestId?: string }
): Promise<void> {
  if (storagePath.includes('..')) {
    throw new Error('Forbidden');
  }

  if (allowedPrefixes.some((prefix) => storagePath.startsWith(prefix))) {
    return;
  }

  if (options?.requestId?.trim() && options.userId) {
    const requestId = options.requestId.trim();
    const proofAllowed = await canAccessPaymentProofForRequest(
      authHeader,
      options.userId,
      requestId,
      storagePath,
      env
    );
    if (proofAllowed) return;

    const summaryAllowed = await canAccessConsultationSummaryPdfForRequest(
      authHeader,
      options.userId,
      requestId,
      storagePath,
      env
    );
    if (summaryAllowed) return;

    const invoiceAllowed = await canAccessConsultationInvoiceForRequest(
      authHeader,
      options.userId,
      requestId,
      storagePath,
      env
    );
    if (invoiceAllowed) return;
  }

  const allowed = await canAccessStoragePathViaRls(authHeader, storagePath, env);
  if (!allowed) {
    throw new Error('Forbidden');
  }
}

function safeFileName(fileName: string): string {
  return fileName.replace(/[^\w.\-() ]+/g, '_').slice(0, 200);
}

function storagePathFor(folder: string, fileName: string): string {
  return `${folder}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
}

const ELIX_ID_PATTERN = /^elix-[a-z]{2}[0-9]{4}$/;

async function getPatientElixId(
  userId: string,
  authHeader: string,
  env: Env
): Promise<string | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;

  const base = env.SUPABASE_URL.replace(/\/$/, '');
  const url = `${base}/rest/v1/patients?auth_user_id=eq.${encodeURIComponent(userId)}&select=elix_id&limit=1`;

  const res = await fetch(url, {
    headers: {
      Authorization: authHeader,
      apikey: env.SUPABASE_ANON_KEY,
      Accept: 'application/json'
    }
  });

  if (!res.ok) return null;

  const rows = (await res.json()) as { elix_id?: string }[];
  const elixId = rows[0]?.elix_id?.trim();
  if (!elixId || !ELIX_ID_PATTERN.test(elixId)) return null;
  return elixId;
}

async function getAllowedPathPrefixes(
  user: AuthUser,
  authHeader: string,
  env: Env
): Promise<string[]> {
  const prefixes = [`${user.id}/`];
  const elixId = await getPatientElixId(user.id, authHeader, env);
  if (elixId) prefixes.push(`${elixId}/`);
  return prefixes;
}

function workerOrigin(request: Request): string {
  return new URL(request.url).origin;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    // Public ping — opening the worker URL in a browser is not an authenticated API call.
    if ((pathname === '/' || pathname === '/health') && request.method === 'GET') {
      return jsonResponse(
        {
          ok: true,
          service: 'elix-medical-records',
          message: 'Use the ElixClinix app while signed in; API routes require Authorization: Bearer <supabase_token>.'
        },
        200,
        origin,
        env
      );
    }

    try {
      const user = await getAuthUser(request, env);
      if (!user) {
        return jsonResponse(
          {
            error: 'Unauthorized',
            hint: 'Send Authorization: Bearer <supabase_access_token> from a signed-in ElixClinix Health session (patient, doctor, or staff).'
          },
          401,
          origin,
          env
        );
      }

      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return jsonResponse({ error: 'Unauthorized' }, 401, origin, env);
      }

      const pathPrefixes = await getAllowedPathPrefixes(user, authHeader, env);

      if (pathname === '/v1/consultation-invoice/upload-url' && request.method === 'POST') {
        const body = (await request.json()) as {
          requestId?: string;
          contentLength?: number;
        };

        if (!body.requestId?.trim()) {
          return jsonResponse({ error: 'requestId is required' }, 400, origin, env);
        }

        const contentLength = Number(body.contentLength ?? 0);
        if (!contentLength || contentLength > 10 * 1024 * 1024) {
          return jsonResponse({ error: 'File must be between 1 byte and 10 MB' }, 400, origin, env);
        }

        const requestId = body.requestId.trim();
        const storagePath = storagePathFor(
          `consultation-invoices/${requestId}`,
          'consultation-invoice.pdf'
        );

        const canUpload = await canStaffUploadConsultationInvoice(
          user.id,
          authHeader,
          requestId,
          storagePath,
          env
        );
        if (!canUpload) {
          return jsonResponse({ error: 'Forbidden' }, 403, origin, env);
        }

        return jsonResponse(
          {
            uploadUrl: `${workerOrigin(request)}/v1/records/object`,
            storagePath,
            storageBucket: env.R2_BUCKET_NAME || 'medical-records'
          },
          200,
          origin,
          env
        );
      }

      if (pathname === '/v1/consultation-summary/upload-url' && request.method === 'POST') {
        const body = (await request.json()) as {
          requestId?: string;
          contentLength?: number;
          fileName?: string;
        };

        if (!body.requestId?.trim()) {
          return jsonResponse({ error: 'requestId is required' }, 400, origin, env);
        }

        const contentLength = Number(body.contentLength ?? 0);
        if (!contentLength || contentLength > 10 * 1024 * 1024) {
          return jsonResponse({ error: 'File must be between 1 byte and 10 MB' }, 400, origin, env);
        }

        const CONSULTATION_NOTES_EXTENSIONS = new Set([
          'pdf',
          'jpg',
          'jpeg',
          'png',
          'webp',
          'heic',
          'heif',
          'gif',
          'doc',
          'docx'
        ]);

        const rawFileName = body.fileName?.trim() || 'consultation-summary.pdf';
        const ext = rawFileName.split('.').pop()?.toLowerCase() ?? '';
        if (!CONSULTATION_NOTES_EXTENSIONS.has(ext)) {
          return jsonResponse(
            { error: 'Unsupported file type. Use PDF, JPG, PNG, DOC, or DOCX.' },
            400,
            origin,
            env
          );
        }

        const requestId = body.requestId.trim();
        const storagePath = storagePathFor(
          `consultation-summaries/${requestId}`,
          rawFileName
        );

        const canUpload = await canDoctorUploadConsultationSummary(
          user.id,
          authHeader,
          requestId,
          storagePath,
          env
        );
        if (!canUpload) {
          return jsonResponse({ error: 'Forbidden' }, 403, origin, env);
        }

        return jsonResponse(
          {
            uploadUrl: `${workerOrigin(request)}/v1/records/object`,
            storagePath,
            storageBucket: env.R2_BUCKET_NAME || 'medical-records'
          },
          200,
          origin,
          env
        );
      }

      if (pathname === '/v1/records/upload-url' && request.method === 'POST') {
        const body = (await request.json()) as {
          fileName?: string;
          contentType?: string;
          contentLength?: number;
        };

        if (!body.fileName?.trim() || !body.contentType?.trim()) {
          return jsonResponse({ error: 'fileName and contentType are required' }, 400, origin, env);
        }

        const contentLength = Number(body.contentLength ?? 0);
        if (!contentLength || contentLength > 10 * 1024 * 1024) {
          return jsonResponse({ error: 'File must be between 1 byte and 10 MB' }, 400, origin, env);
        }

        const elixFolder = pathPrefixes.find((prefix) => prefix.startsWith('elix-'));
        const folder = elixFolder ? elixFolder.slice(0, -1) : user.id;
        const storagePath = storagePathFor(folder, body.fileName.trim());

        return jsonResponse(
          {
            uploadUrl: `${workerOrigin(request)}/v1/records/object`,
            storagePath,
            storageBucket: env.R2_BUCKET_NAME || 'medical-records',
            folder
          },
          200,
          origin,
          env
        );
      }

      if (pathname === '/v1/records/object' && request.method === 'PUT') {
        const storagePath = request.headers.get('X-Storage-Path')?.trim();
        if (!storagePath) {
          return jsonResponse({ error: 'X-Storage-Path header is required' }, 400, origin, env);
        }

        const ownsPrefix = pathPrefixes.some((prefix) => storagePath.startsWith(prefix));
        if (!ownsPrefix) {
          const consultationPrefix = 'consultation-summaries/';
          const invoicePrefix = 'consultation-invoices/';
          if (storagePath.startsWith(consultationPrefix)) {
            const requestId = storagePath.slice(consultationPrefix.length).split('/')[0];
            if (!requestId) {
              throw new Error('Forbidden');
            }
            const canUpload = await canDoctorUploadConsultationSummary(
              user.id,
              authHeader,
              requestId,
              storagePath,
              env
            );
            if (!canUpload) {
              throw new Error('Forbidden');
            }
          } else if (storagePath.startsWith(invoicePrefix)) {
            const requestId = storagePath.slice(invoicePrefix.length).split('/')[0];
            if (!requestId) {
              throw new Error('Forbidden');
            }
            const canUpload = await canStaffUploadConsultationInvoice(
              user.id,
              authHeader,
              requestId,
              storagePath,
              env
            );
            if (!canUpload) {
              throw new Error('Forbidden');
            }
          } else {
            throw new Error('Forbidden');
          }
        }

        const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
        if (!request.body) {
          return jsonResponse({ error: 'Request body is required' }, 400, origin, env);
        }

        await env.MEDICAL_RECORDS.put(storagePath, request.body, {
          httpMetadata: { contentType }
        });

        return jsonResponse({ ok: true }, 200, origin, env);
      }

      if (pathname === '/v1/records/download' && request.method === 'POST') {
        const body = (await request.json()) as { storagePath?: string; requestId?: string };
        if (!body.storagePath?.trim()) {
          return jsonResponse({ error: 'storagePath is required' }, 400, origin, env);
        }

        const storagePath = body.storagePath.trim();
        await assertCanAccessPath(pathPrefixes, authHeader, storagePath, env, {
          userId: user.id,
          requestId: body.requestId
        });

        const object = await env.MEDICAL_RECORDS.get(storagePath);
        if (!object) {
          return jsonResponse({ error: 'File not found' }, 404, origin, env);
        }

        const headers = new Headers(corsHeaders(origin, env));
        headers.set('Content-Type', object.httpMetadata?.contentType ?? 'application/octet-stream');
        if (object.size) {
          headers.set('Content-Length', String(object.size));
        }

        return new Response(object.body, { status: 200, headers });
      }

      if (pathname === '/v1/records/object' && request.method === 'DELETE') {
        const body = (await request.json()) as { storagePath?: string };
        if (!body.storagePath?.trim()) {
          return jsonResponse({ error: 'storagePath is required' }, 400, origin, env);
        }

        const storagePath = body.storagePath.trim();
        assertOwnsPath(pathPrefixes, storagePath);
        await env.MEDICAL_RECORDS.delete(storagePath);

        return jsonResponse({ ok: true }, 200, origin, env);
      }

      return jsonResponse({ error: 'Not found' }, 404, origin, env);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed';
      const status = message === 'Forbidden' ? 403 : 500;
      return jsonResponse({ error: message }, status, origin, env);
    }
  }
};

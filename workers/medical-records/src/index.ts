type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
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

async function canAccessStoragePathViaRls(
  authHeader: string,
  storagePath: string,
  env: Env
): Promise<boolean> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return false;

  const base = env.SUPABASE_URL.replace(/\/$/, '');
  const url = `${base}/rest/v1/uploaded_files?storage_path=eq.${encodeURIComponent(storagePath)}&select=id&limit=1`;

  const res = await fetch(url, {
    headers: {
      Authorization: authHeader,
      apikey: env.SUPABASE_ANON_KEY,
      Accept: 'application/json'
    }
  });

  if (!res.ok) return false;

  const rows = (await res.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

async function assertCanAccessPath(
  allowedPrefixes: string[],
  authHeader: string,
  storagePath: string,
  env: Env
): Promise<void> {
  if (storagePath.includes('..')) {
    throw new Error('Forbidden');
  }

  if (allowedPrefixes.some((prefix) => storagePath.startsWith(prefix))) {
    return;
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
          message: 'Use the Elix app while signed in; API routes require Authorization: Bearer <supabase_token>.'
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
            hint: 'Send Authorization: Bearer <supabase_access_token> from a signed-in patient session.'
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

        assertOwnsPath(pathPrefixes, storagePath);

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
        const body = (await request.json()) as { storagePath?: string };
        if (!body.storagePath?.trim()) {
          return jsonResponse({ error: 'storagePath is required' }, 400, origin, env);
        }

        const storagePath = body.storagePath.trim();
        await assertCanAccessPath(pathPrefixes, authHeader, storagePath, env);

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

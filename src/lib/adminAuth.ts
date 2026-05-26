import { supabase } from './supabase';

export type AccountRole = 'doctor' | 'patient';

export type AccountAuthStatus = {
  role: AccountRole;
  profileId: string;
  email: string;
  hasAuth: boolean;
  loginEnabled: boolean;
  loginDisabled: boolean;
};

const FETCH_TIMEOUT_MS = 20_000;

function adminAuthBaseUrl(): string | null {
  const url = import.meta.env.VITE_ADMIN_AUTH_API_URL?.trim();
  return url ? url.replace(/\/$/, '') : null;
}

async function adminAuthFetch<T>(path: string, init?: RequestInit): Promise<{ data: T | null; error: string | null }> {
  const base = adminAuthBaseUrl();
  if (!base) {
    return {
      data: null,
      error: 'VITE_ADMIN_AUTH_API_URL is not set. Deploy workers/admin-auth and add the URL to .env.local.'
    };
  }

  let session;
  try {
    const result = await supabase.auth.getSession();
    session = result.data.session;
  } catch {
    return { data: null, error: 'Could not read admin session. Sign in again.' };
  }

  const token = session?.access_token;
  if (!token) {
    return { data: null, error: 'Admin session expired. Sign in again.' };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {})
      }
    });

    const body = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      return { data: null, error: body.error ?? res.statusText ?? `Request failed (${res.status})` };
    }
    return { data: body as T, error: null };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { data: null, error: 'Login service timed out. Check VITE_ADMIN_AUTH_API_URL and retry.' };
    }
    if (err instanceof TypeError) {
      return {
        data: null,
        error: 'Could not reach login service (network/CORS). Use http://localhost:3000 or redeploy the admin-auth worker.'
      };
    }
    return { data: null, error: err instanceof Error ? err.message : 'Request failed.' };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchAccountAuthStatus(role: AccountRole, profileId: string) {
  const params = new URLSearchParams({ role, profileId });
  return adminAuthFetch<AccountAuthStatus>(`/status?${params.toString()}`);
}

export async function manageAccountAuth(
  role: AccountRole,
  profileId: string,
  action: 'enable' | 'disable' | 'set_password',
  password?: string
) {
  return adminAuthFetch<{ ok: boolean; status: AccountAuthStatus }>('/manage', {
    method: 'POST',
    body: JSON.stringify({ role, profileId, action, password })
  });
}

export function loginStatusLabel(status: AccountAuthStatus | null, authUserId?: string | null, loginDisabled?: boolean): string {
  if (status) {
    if (!status.hasAuth) return 'No login';
    return status.loginEnabled ? 'Enabled' : 'Disabled';
  }
  if (!authUserId) return 'No login';
  return loginDisabled ? 'Disabled' : 'Linked';
}

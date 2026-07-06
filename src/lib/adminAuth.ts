import { supabase } from './supabase';

export type AccountRole = 'doctor' | 'patient';
export type RequestLifecycleEvent =
  | 'patient_request_submitted'
  | 'request_assigned_to_pse'
  | 'request_released_to_doctor';

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
        error:
          'Could not reach login service (network/CORS). Run the app at http://localhost:3000, set VITE_ADMIN_AUTH_API_URL to your admin-auth worker, and run npm run worker:admin-auth:dev (port 8788) or redeploy the worker.'
      };
    }
    return { data: null, error: err instanceof Error ? err.message : 'Request failed.' };
  } finally {
    window.clearTimeout(timeout);
  }
}

export type StaffMemberPayload = {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  role: 'administrator' | 'patient_service_executive' | 'patient_service_executive_clinic';
  clinic_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function createStaffMember(input: {
  full_name: string;
  email: string;
  password?: string;
  role?: 'administrator' | 'patient_service_executive' | 'patient_service_executive_clinic';
  clinic_name?: string;
  clinic_id?: string;
}) {
  return adminAuthFetch<{ ok: boolean; staff: StaffMemberPayload }>('/staff', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function createPatientServiceExecutive(input: {
  full_name: string;
  email: string;
  password?: string;
}) {
  return createStaffMember({ ...input, role: 'patient_service_executive' });
}

export async function manageStaffMember(
  staffId: string,
  action: 'activate' | 'deactivate' | 'set_password' | 'update',
  options?: {
    password?: string;
    full_name?: string;
    email?: string;
    clinic_id?: string;
    clinic_name?: string;
  }
) {
  return adminAuthFetch<{ ok: boolean; staff: StaffMemberPayload }>('/staff/manage', {
    method: 'POST',
    body: JSON.stringify({ staffId, action, ...options })
  });
}

export async function updateStaffMember(
  staffId: string,
  input: {
    full_name: string;
    email: string;
    password?: string;
    clinic_id?: string;
    clinic_name?: string;
  }
) {
  return manageStaffMember(staffId, 'update', input);
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

export type PatientProvisionLoginResult = {
  ok: boolean;
  status: AccountAuthStatus | null;
  emailSent: boolean;
  warning?: string;
};

export async function provisionPatientLogin(profileId: string) {
  return adminAuthFetch<PatientProvisionLoginResult>('/patient/provision-login', {
    method: 'POST',
    body: JSON.stringify({ profileId })
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

export async function notifyRequestLifecycleEmail(input: {
  event: RequestLifecycleEvent;
  requestId: string;
}) {
  const requestId = input.requestId.trim();
  if (!requestId) return { data: null, error: 'requestId is required.' };

  return adminAuthFetch<{ ok: boolean; delivered?: number; skipped?: boolean }>(
    '/notify/request-lifecycle',
    {
      method: 'POST',
      body: JSON.stringify({ event: input.event, requestId })
    }
  );
}

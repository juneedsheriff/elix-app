import { supabase } from './supabase';

/** Returns a usable access token, refreshing the session when close to expiry. */
export async function ensureFreshAccessToken(
  options?: { forceRefresh?: boolean }
): Promise<string | null> {
  const { data: current } = await supabase.auth.getSession();
  const session = current.session;
  if (!session?.access_token) return null;

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  const isExpired = !expiresAtMs || expiresAtMs <= Date.now();
  const shouldRefresh =
    Boolean(options?.forceRefresh) || isExpired || expiresAtMs < Date.now() + 120_000;

  if (!shouldRefresh) return session.access_token;

  const { data: refreshed, error } = await supabase.auth.refreshSession();
  if (!error && refreshed.session?.access_token) {
    return refreshed.session.access_token;
  }

  // Never hand the worker an already-expired JWT (triggers generic Unauthorized).
  if (isExpired || expiresAtMs <= Date.now() + 5_000) {
    return null;
  }
  return session.access_token;
}

export function normalizeStorageAuthError(message: string): string {
  const normalized = message.trim();
  if (
    normalized === 'Unauthorized' ||
    normalized.startsWith('Unauthorized ') ||
    normalized.startsWith('Unauthorized—') ||
    normalized.includes('Bearer <supabase')
  ) {
    const detail = normalized
      .replace(/^Unauthorized\s*[—–-]?\s*/i, '')
      .trim();
    // Prefer the worker's specific auth hint when present.
    if (
      detail &&
      detail.toLowerCase() !== 'unauthorized' &&
      (detail.includes('SUPABASE') ||
        detail.includes('token') ||
        detail.includes('Sign out') ||
        detail.includes('secret') ||
        detail.includes('auth'))
    ) {
      return detail;
    }
    return 'Could not upload or open the consultation PDF. Sign out, sign in again, and retry. If it persists, ensure VITE_R2_API_URL points to the medical-records worker and that worker SUPABASE_URL/ANON_KEY match this app.';
  }
  if (
    normalized === 'Forbidden' ||
    normalized.startsWith('Forbidden') ||
    normalized.includes('not the assigned doctor') ||
    normalized.includes('No doctor profile is linked')
  ) {
    if (normalized.includes(' — ') || normalized.includes(' —')) {
      return normalized.replace(/^Forbidden\s*[—–-]\s*/i, '');
    }
    return 'Could not upload the consultation PDF. Confirm this case is assigned to your doctor profile, then sign out and sign in again. If it persists, ensure VITE_R2_API_URL points to the medical-records worker.';
  }
  return message;
}

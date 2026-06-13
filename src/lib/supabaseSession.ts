import { supabase } from './supabase';

/** Returns a usable access token, refreshing the session when close to expiry. */
export async function ensureFreshAccessToken(): Promise<string | null> {
  const { data: current } = await supabase.auth.getSession();
  const session = current.session;
  if (!session?.access_token) return null;

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  const shouldRefresh = !expiresAtMs || expiresAtMs < Date.now() + 120_000;

  if (!shouldRefresh) return session.access_token;

  const { data: refreshed, error } = await supabase.auth.refreshSession();
  if (error || !refreshed.session?.access_token) {
    return session.access_token;
  }
  return refreshed.session.access_token;
}

export function normalizeStorageAuthError(message: string): string {
  if (message === 'Unauthorized' || message === 'Forbidden') {
    return 'Could not upload or open the consultation PDF. Sign out, sign in again, and retry. If it persists, ensure VITE_R2_API_URL points to the medical-records worker.';
  }
  return message;
}

/**
 * URL Supabase redirects to after email confirm, magic link, or password reset.
 * Must match an entry in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.
 */
export function getAuthRedirectUrl(path = '/'): string {
  const configured = import.meta.env.VITE_APP_URL?.trim();
  if (configured) {
    const base = configured.replace(/\/$/, '');
    return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    const base = window.location.origin.replace(/\/$/, '');
    return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
  }

  return path.startsWith('/') ? path : `/${path}`;
}

/** Parse Supabase auth errors from the URL hash after email link redirects. */
export function parseAuthHashError(): { code: string | null; description: string | null } | null {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash?.replace(/^#/, '');
  if (!hash || !hash.includes('error=')) return null;

  const params = new URLSearchParams(hash);
  const code = params.get('error_code') ?? params.get('error');
  const description = params.get('error_description')?.replace(/\+/g, ' ') ?? null;
  return { code, description };
}

export function clearAuthHashFromUrl(): void {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}

export function isPasswordRecoveryCallback(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash?.replace(/^#/, '') ?? '';
  const search = window.location.search?.replace(/^\?/, '') ?? '';
  const params = new URLSearchParams(hash || search);
  return params.get('type') === 'recovery';
}

export function authHashErrorMessage(code: string | null, description: string | null): string {
  if (code === 'otp_expired') {
    return 'This email link has expired. Request a new confirmation email below, then open the latest link.';
  }
  if (code === 'access_denied' && description?.toLowerCase().includes('expired')) {
    return 'This email link has expired. Request a new confirmation email below, then open the latest link.';
  }
  if (description) return description;
  if (code) return `Sign-in link failed (${code}).`;
  return 'Email link could not be verified. Try signing in or request a new link.';
}

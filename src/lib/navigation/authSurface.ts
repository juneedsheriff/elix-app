export type AuthSurface = 'desktop' | 'mobile';

export const AUTH_SURFACE_KEY = 'elix:authSurface';

export function setAuthSurface(surface: AuthSurface) {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(AUTH_SURFACE_KEY, surface);
}

export function getAuthSurface(): AuthSurface | null {
  if (typeof sessionStorage === 'undefined') return null;
  const value = sessionStorage.getItem(AUTH_SURFACE_KEY);
  return value === 'desktop' || value === 'mobile' ? value : null;
}

export function clearAuthSurface() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(AUTH_SURFACE_KEY);
}

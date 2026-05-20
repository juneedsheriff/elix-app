import type { Role } from '../../i18n/appTranslations';
import { NAV_IDS } from '../../i18n/appTranslations';

export const APP_ROUTE_PREFIX = '/app';

const ALL_SCREEN_IDS = new Set(
  Object.values(NAV_IDS).flatMap((ids) => ids)
);

export function appScreenPath(screenId: string): string {
  return `${APP_ROUTE_PREFIX}/${encodeURIComponent(screenId)}`;
}

export function parseAppScreenPath(pathname: string): string | null {
  const match = pathname.match(new RegExp(`^${APP_ROUTE_PREFIX}/([^/]+)/?$`));
  if (!match?.[1]) return null;
  const screenId = decodeURIComponent(match[1]);
  return ALL_SCREEN_IDS.has(screenId) ? screenId : null;
}

export function isScreenAllowedForRole(role: Role, screenId: string): boolean {
  return NAV_IDS[role].includes(screenId);
}

export function defaultScreenForRole(role: Role): string {
  return NAV_IDS[role][0] ?? 'patient-dashboard';
}

/** Pick URL or preferred screen when valid for role; otherwise role default. */
export function resolveScreenForRole(role: Role, preferred?: string | null): string {
  if (preferred && isScreenAllowedForRole(role, preferred)) return preferred;
  return defaultScreenForRole(role);
}

export const RETURN_SCREEN_KEY = 'elix:returnScreen';

export function saveReturnScreen(screenId: string) {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(RETURN_SCREEN_KEY, screenId);
}

export function consumeReturnScreen(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  const value = sessionStorage.getItem(RETURN_SCREEN_KEY);
  sessionStorage.removeItem(RETURN_SCREEN_KEY);
  return value;
}

import type { NavigateFunction } from 'react-router-dom';
import { appScreenPath } from './appRoutes';

export type PendingOpinionRequest =
  | { flow: 'doctor-opinion'; doctorId: string }
  | { flow: 'recommendation-opinion' };

const STORAGE_KEY = 'elix:pendingOpinionRequest';

export function savePendingOpinionRequest(pending: PendingOpinionRequest): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
}

export function getPendingOpinionRequest(): PendingOpinionRequest | null {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingOpinionRequest;
    if (parsed.flow === 'doctor-opinion' && typeof parsed.doctorId === 'string') {
      return parsed;
    }
    if (parsed.flow === 'recommendation-opinion') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPendingOpinionRequest(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export function navigateToResumePendingOpinionRequest(
  navigate: NavigateFunction,
  onNavigate?: (screenId: string) => void
): boolean {
  const pending = getPendingOpinionRequest();
  if (!pending) return false;

  if (pending.flow === 'recommendation-opinion') {
    navigate(`${appScreenPath('my-requests')}?flow=recommendations`, { replace: true });
    return true;
  }

  if (onNavigate) {
    onNavigate('doctor-list');
  } else {
    navigate(appScreenPath('doctor-list'), { replace: true });
  }
  return true;
}

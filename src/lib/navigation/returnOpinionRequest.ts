const STORAGE_KEY = 'elix:returnOpinionRequestId';

export function saveReturnOpinionRequestId(requestId: string): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, requestId);
}

export function consumeReturnOpinionRequestId(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  const id = sessionStorage.getItem(STORAGE_KEY)?.trim();
  if (!id) return null;
  sessionStorage.removeItem(STORAGE_KEY);
  return id;
}

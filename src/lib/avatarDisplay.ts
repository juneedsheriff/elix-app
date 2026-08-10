import { DEFAULT_DOCTOR_IMAGE_PLACEHOLDER } from './doctorProfile';

/** Gmail-style avatar palette (solid, white initials). */
const GMAIL_AVATAR_COLORS = [
  '#DB4437',
  '#E91E63',
  '#9C27B0',
  '#673AB7',
  '#3F51B5',
  '#4285F4',
  '#039BE5',
  '#0097A7',
  '#0B8043',
  '#7CB342',
  '#F4511E',
  '#EF6C00',
  '#F09300',
  '#795548',
  '#607D8B'
] as const;

/** First + last initials (single letter when one name), Gmail-style. */
export function displayInitials(name: string | null | undefined): string {
  const parts = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

/** Stable solid background color for initials avatars. */
export function avatarColorFromName(name: string | null | undefined): string {
  const seed = (name ?? '').trim().toLowerCase() || '?';
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GMAIL_AVATAR_COLORS.length;
  return GMAIL_AVATAR_COLORS[index];
}

/**
 * Real profile photo URL, or null for empty/placeholder images so UI can show initials.
 */
export function resolveProfilePhotoUrl(imageUrl: string | null | undefined): string | null {
  const url = imageUrl?.trim();
  if (!url) return null;
  if (url === DEFAULT_DOCTOR_IMAGE_PLACEHOLDER) return null;
  if (/placehold\.co/i.test(url)) return null;
  if (/via\.placeholder\.com/i.test(url)) return null;
  if (/ui-avatars\.com/i.test(url)) return null;
  if (/text=Doctor/i.test(url)) return null;
  if (/text=Patient/i.test(url)) return null;
  return url;
}

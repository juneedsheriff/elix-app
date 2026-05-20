/** Shared helpers for doctor seed / auth scripts */

export const DEFAULT_DOCTOR_PASSWORD = process.env.DOCTOR_DEFAULT_PASSWORD ?? 'Elix@123';

export function slugifyName(fullName) {
  return fullName
    .replace(/^Dr\.\s*/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

export function doctorEmail(fullName, index) {
  const slug = slugifyName(fullName);
  return `${slug || `doctor${index + 1}`}@elixapp.health`;
}

export function doctorPhone(index) {
  const n = String(index + 1).padStart(2, '0');
  return `+1-555-01${n}`;
}

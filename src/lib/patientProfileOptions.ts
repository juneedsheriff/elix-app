export const PATIENT_GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'] as const;

/** Clinic PSE patient forms — Gender is Male/Female only. */
export const CLINIC_PSE_PATIENT_GENDER_OPTIONS = ['Male', 'Female'] as const;

export const PATIENT_BLOOD_GROUP_OPTIONS = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
  'Unknown'
] as const;

/** Clinic PSE patient forms — standard ABO groups only. */
export const CLINIC_PSE_PATIENT_BLOOD_GROUP_OPTIONS = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-'
] as const;

const PREFERRED_LANGUAGE_PRIORITY = [
  'English',
  'Hindi',
  'Spanish',
  'French',
  'Punjabi',
  'Tamil',
  'Telugu',
  'Bengali',
  'Marathi',
  'Urdu',
  'Gujarati',
  'Arabic'
] as const;

const PREFERRED_LANGUAGE_REGIONAL = [
  'Assamese',
  'Bodo',
  'Cantonese',
  'Chinese',
  'Dogri',
  'German',
  'Italian',
  'Japanese',
  'Kannada',
  'Kashmiri',
  'Konkani',
  'Korean',
  'Maithili',
  'Malayalam',
  'Mandarin Chinese',
  'Manipuri',
  'Nepali',
  'Odia',
  'Persian (Farsi)',
  'Polish',
  'Portuguese',
  'Russian',
  'Santali',
  'Sindhi',
  'Tagalog',
  'Vietnamese'
] as const;

const LEGACY_LANGUAGE_CODES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  ar: 'Arabic'
};

export const PATIENT_PREFERRED_LANGUAGE_OPTIONS = [
  ...PREFERRED_LANGUAGE_PRIORITY,
  ...PREFERRED_LANGUAGE_REGIONAL.filter(
    (language) => !PREFERRED_LANGUAGE_PRIORITY.includes(language as (typeof PREFERRED_LANGUAGE_PRIORITY)[number])
  )
] as const;

export function normalizePreferredLanguage(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return 'English';
  return LEGACY_LANGUAGE_CODES[trimmed] ?? trimmed;
}

export function normalizePreferredLanguagePart(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return LEGACY_LANGUAGE_CODES[trimmed] ?? trimmed;
}

export function parsePreferredLanguages(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];

  const seen = new Set<string>();
  const languages: string[] = [];

  for (const part of value.split(/[,;|]/)) {
    const normalized = normalizePreferredLanguagePart(part);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    languages.push(normalized);
  }

  return languages;
}

export function serializePreferredLanguages(languages: string[]): string {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const language of languages) {
    const value = normalizePreferredLanguagePart(language);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
  }

  return normalized.length > 0 ? normalized.join(', ') : 'English';
}

export function formatPreferredLanguages(value: string | null | undefined): string {
  const languages = parsePreferredLanguages(value);
  return languages.length > 0 ? languages.join(', ') : 'Not set';
}

export function preferredLanguageSuggestions(currentValue?: string | null): string[] {
  const options = new Set<string>(PATIENT_PREFERRED_LANGUAGE_OPTIONS);
  for (const language of parsePreferredLanguages(currentValue)) {
    options.add(language);
  }
  if (currentValue?.trim() && !currentValue.includes(',')) {
    options.add(normalizePreferredLanguagePart(currentValue));
  }
  const priority = PREFERRED_LANGUAGE_PRIORITY.filter((language) => options.has(language));
  const rest = [...options]
    .filter((language) => !priority.includes(language as (typeof PREFERRED_LANGUAGE_PRIORITY)[number]))
    .sort((a, b) => a.localeCompare(b));
  return [...priority, ...rest];
}

export function filterPreferredLanguageSuggestions(query: string, selected: string[]): string[] {
  const needle = query.trim().toLowerCase();
  const selectedKeys = new Set(selected.map((language) => language.toLowerCase()));

  return preferredLanguageSuggestions()
    .filter((language) => {
      if (selectedKeys.has(language.toLowerCase())) return false;
      if (!needle) return true;
      return language.toLowerCase().includes(needle);
    })
    .slice(0, 10);
}

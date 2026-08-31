export const HOME_CARE_SERVICE_OPTIONS = [
  { id: 'home_nursing', label: 'Home Nursing Services' },
  { id: 'physiotherapy', label: 'Physiotherapy Services' },
  { id: 'sample_collection', label: 'Sample Collection at Home' },
  { id: 'parent_care', label: 'Parent Care' },
  { id: 'patient_escort', label: 'Patient Escort Services' },
  { id: 'surgery_referral', label: 'Surgery Referral' },
  { id: 'others', label: 'Others' }
] as const;

export type HomeCareServiceId = (typeof HOME_CARE_SERVICE_OPTIONS)[number]['id'];

export const HOME_CARE_REQUESTED_SPECIALTY = 'Home Care';

export type HomeCareServiceSelection = {
  serviceIds: HomeCareServiceId[];
  otherNote: string;
};

export function homeCareServiceLabel(id: HomeCareServiceId): string {
  return HOME_CARE_SERVICE_OPTIONS.find((option) => option.id === id)?.label ?? id;
}

export function formatHomeCareServicesMessage(selection: HomeCareServiceSelection): string {
  const labels = selection.serviceIds.map(homeCareServiceLabel);
  const lines = ['Home care services requested:', ...labels.map((label) => `• ${label}`)];

  const otherNote = selection.otherNote.trim();
  if (selection.serviceIds.includes('others') && otherNote) {
    lines.push(`Other details: ${otherNote}`);
  }

  return lines.join('\n');
}

export function buildHomeCareCaseDetails(selection: HomeCareServiceSelection) {
  return {
    requestKind: 'home_care' as const,
    homeCareServices: selection.serviceIds.map(homeCareServiceLabel),
    homeCareServiceIds: selection.serviceIds,
    homeCareOtherNote: selection.otherNote.trim() || null,
    primaryHealthConcern: formatHomeCareServicesMessage(selection)
  };
}

export function validateHomeCareSelection(selection: HomeCareServiceSelection): string | null {
  if (!selection.serviceIds.length) {
    return 'Select at least one home care service.';
  }
  if (selection.serviceIds.includes('others') && !selection.otherNote.trim()) {
    return 'Please describe the other home care service needed.';
  }
  return null;
}

export function isHomeCareOpinionRequest(request: {
  requested_specialty?: string | null;
  patient_case_details?: unknown | null;
  message?: string | null;
}): boolean {
  if (request.requested_specialty?.trim().toLowerCase() === HOME_CARE_REQUESTED_SPECIALTY.toLowerCase()) {
    return true;
  }

  const details = request.patient_case_details;
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    const kind = (details as { requestKind?: unknown }).requestKind;
    if (kind === 'home_care') return true;
    const services = (details as { homeCareServices?: unknown }).homeCareServices;
    if (Array.isArray(services) && services.length > 0) return true;
  }

  const message = request.message?.trim().toLowerCase() ?? '';
  return message.startsWith('home care services requested:');
}

export function homeCareServicesFromRequest(request: {
  patient_case_details?: unknown | null;
  message?: string | null;
}): string[] {
  const details = request.patient_case_details;
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    const services = (details as { homeCareServices?: unknown }).homeCareServices;
    if (Array.isArray(services)) {
      return services.map((item) => String(item).trim()).filter(Boolean);
    }
  }

  const message = request.message?.trim() ?? '';
  if (!message.toLowerCase().startsWith('home care services requested:')) return [];

  return message
    .split('\n')
    .map((line) => line.replace(/^•\s*/, '').trim())
    .filter(
      (line) =>
        line &&
        !line.toLowerCase().startsWith('home care') &&
        !line.toLowerCase().startsWith('other details')
    );
}

function parseOtherDetailsFromMessage(message: string | null | undefined): string | null {
  if (!message?.trim()) return null;
  const match = message.match(/other details:\s*([\s\S]+)/i);
  const note = match?.[1]?.trim();
  return note || null;
}

/** Description entered when the patient/PSE selects Home Care → Others. */
export function homeCareOtherNoteFromRequest(request: {
  patient_case_details?: unknown | null;
  message?: string | null;
}): string | null {
  const details = request.patient_case_details;
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    const stored = (details as { homeCareOtherNote?: unknown }).homeCareOtherNote;
    if (typeof stored === 'string' && stored.trim()) return stored.trim();

    const concern = (details as { primaryHealthConcern?: unknown }).primaryHealthConcern;
    if (typeof concern === 'string') {
      const fromConcern = parseOtherDetailsFromMessage(concern);
      if (fromConcern) return fromConcern;
    }
  }

  return parseOtherDetailsFromMessage(request.message);
}

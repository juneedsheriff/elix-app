import type { ConsultationHours, ConsultationHoursDay, ConsultationHoursInterval, Doctor } from '../types/doctor';

const DAY_LABELS: Record<keyof ConsultationHours, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday'
};

function dayIntervals(day: ConsultationHoursDay): ConsultationHoursInterval[] {
  if (!day.enabled) return [];
  if (day.intervals?.length) return day.intervals;
  return [{ start: day.start, end: day.end }];
}

function formatInterval(start: string, end: string): string {
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = Number(hours);
    if (!Number.isFinite(hour)) return time;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes ?? '00'} ${suffix}`;
  };
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function formatDay(day: ConsultationHoursDay): string {
  if (!day.enabled) return 'Unavailable';
  return dayIntervals(day).map((interval) => formatInterval(interval.start, interval.end)).join(', ');
}

/** Human-readable weekly consultation hours for PSE review. */
export function formatDoctorConsultationHours(hours: ConsultationHours | null | undefined): string[] {
  if (!hours) return ['No consultation hours configured for this doctor.'];
  return (Object.keys(DAY_LABELS) as (keyof ConsultationHours)[]).map(
    (key) => `${DAY_LABELS[key]}: ${formatDay(hours[key])}`
  );
}

export function findDoctorById(doctors: Doctor[], doctorId: string | null | undefined): Doctor | null {
  if (!doctorId) return null;
  return doctors.find((d) => d.id === doctorId) ?? null;
}

export type PatientAvailabilityPayload = {
  preferred_at?: string | null;
  notes?: string | null;
  display?: string | null;
};

export function formatPatientAvailability(raw: unknown): string {
  if (!raw) return '';
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'object' && raw !== null) {
    const payload = raw as PatientAvailabilityPayload;
    if (typeof payload.display === 'string' && payload.display.trim()) {
      return payload.display.trim();
    }
    const parts: string[] = [];
    if (typeof payload.preferred_at === 'string' && payload.preferred_at.trim()) {
      const parsed = new Date(payload.preferred_at);
      parts.push(
        Number.isNaN(parsed.getTime())
          ? payload.preferred_at.trim()
          : parsed.toLocaleString()
      );
    }
    if (typeof payload.notes === 'string' && payload.notes.trim()) {
      parts.push(payload.notes.trim());
    }
    if (parts.length) return parts.join('\n');
    const legacyNotes = (raw as { notes?: unknown }).notes;
    if (typeof legacyNotes === 'string') return legacyNotes.trim();
    return JSON.stringify(raw, null, 2);
  }
  return String(raw);
}

/** Format ISO timestamp for `<input type="datetime-local" />`. */
export function toDatetimeLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function buildPatientAvailabilityPayload(input: {
  preferredAt: string;
  notes?: string;
}): PatientAvailabilityPayload {
  const preferredAt = input.preferredAt.trim();
  const notes = input.notes?.trim() || '';
  const parsed = preferredAt ? new Date(preferredAt) : null;
  const timeLabel =
    parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleString() : preferredAt;
  const display = [timeLabel, notes].filter(Boolean).join('\n');
  return {
    preferred_at: preferredAt || null,
    notes: notes || null,
    display: display || null
  };
}

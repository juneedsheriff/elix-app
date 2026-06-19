import type { ReactNode } from 'react';
import { DOCTOR_SPECIALTY_OPTIONS } from '../../../lib/doctorSpecialtyOptions';

export function RequiredMark() {
  return (
    <span className='elixhealth-required' aria-hidden='true'>
      {' '}
      *
    </span>
  );
}

export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span>
      {children}
      {required ? <RequiredMark /> : null}
    </span>
  );
}

/** Include the doctor's current specialty when it is not in the standard list. */
export function specialtyOptionsForValue(current: string): string[] {
  const trimmed = current.trim();
  if (!trimmed) return [...DOCTOR_SPECIALTY_OPTIONS];
  const inList = (DOCTOR_SPECIALTY_OPTIONS as readonly string[]).includes(trimmed);
  return inList ? [...DOCTOR_SPECIALTY_OPTIONS] : [trimmed, ...DOCTOR_SPECIALTY_OPTIONS];
}

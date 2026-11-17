import { useEffect, useState } from 'react';
import { consultationCurrencyForClinicId } from '../lib/clinicBranch';
import type { ConsultationCurrency } from '../types/doctor';

/**
 * Resolves display currency from a PSE clinic id.
 * Global patients (no clinic) → USD; India → INR; other PSE countries → USD.
 */
export function useClinicConsultationCurrency(clinicId: string | null | undefined) {
  const [displayCurrency, setDisplayCurrency] = useState<ConsultationCurrency>(() =>
    clinicId?.trim() ? 'INR' : 'USD'
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const currency = await consultationCurrencyForClinicId(clinicId);
      if (!cancelled) setDisplayCurrency(currency);
    })();
    return () => {
      cancelled = true;
    };
  }, [clinicId]);

  return displayCurrency;
}

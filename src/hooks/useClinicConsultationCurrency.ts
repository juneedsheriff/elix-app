import { useEffect, useState } from 'react';
import { consultationCurrencyForClinicId } from '../lib/clinicBranch';
import { consultationCurrencyForPseCountry, DEFAULT_PSE_COUNTRY } from '../lib/pseCountry';
import type { ConsultationCurrency } from '../types/doctor';

/** Resolves display currency from a PSE clinic id (India → INR, else USD). Defaults to India/INR. */
export function useClinicConsultationCurrency(clinicId: string | null | undefined) {
  const [displayCurrency, setDisplayCurrency] = useState<ConsultationCurrency>(() =>
    consultationCurrencyForPseCountry(DEFAULT_PSE_COUNTRY)
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

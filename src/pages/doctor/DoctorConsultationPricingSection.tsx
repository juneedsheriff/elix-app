import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import SectionCard from '../../components/ui/SectionCard';
import {
  CONSULTATION_CURRENCY_OPTIONS,
  consultationCurrencySymbol,
  normalizeConsultationCurrency
} from '../../lib/consultationCurrency';
import {
  ensureStandardConsultationTiers,
  primaryConsultationFeeFromTiers
} from '../../lib/consultationTiers';
import { updateDoctorConsultationPricing } from '../../lib/doctors';
import type { ConsultationCurrency, ConsultationTier, Doctor } from '../../types/doctor';
import './doctor-pricing.css';

type DoctorConsultationPricingSectionProps = {
  doctorProfile: Doctor | null | undefined;
  onUpdated?: (doctor: Doctor) => void;
  title?: string;
  subtitle?: string;
};

function tiersFromFee(feeUsd: number): ConsultationTier[] {
  const fee = Math.max(0, Math.round(feeUsd));
  return ensureStandardConsultationTiers([], fee).map((tier) => ({
    ...tier,
    fee_usd: fee
  }));
}

function feeFromDoctor(doctor: Doctor | null | undefined): number {
  if (!doctor) return 0;
  if (doctor.consultation_tiers?.length) {
    return primaryConsultationFeeFromTiers(
      ensureStandardConsultationTiers(
        doctor.consultation_tiers,
        doctor.consultation_fee ?? doctor.fee_usd ?? 0
      )
    );
  }
  return Math.max(0, Math.round(doctor.consultation_fee ?? doctor.fee_usd ?? 0));
}

export default function DoctorConsultationPricingSection({
  doctorProfile,
  onUpdated,
  title = 'Consultation pricing',
  subtitle = 'Set the consultation charge shown on requests and payment steps'
}: DoctorConsultationPricingSectionProps) {
  const [feeUsd, setFeeUsd] = useState(() => feeFromDoctor(doctorProfile));
  const [currency, setCurrency] = useState<ConsultationCurrency>(() =>
    normalizeConsultationCurrency(doctorProfile?.consultation_currency)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setFeeUsd(feeFromDoctor(doctorProfile));
    setCurrency(normalizeConsultationCurrency(doctorProfile?.consultation_currency));
  }, [doctorProfile]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    const { data, error: saveError } = await updateDoctorConsultationPricing(
      tiersFromFee(feeUsd),
      currency
    );
    setBusy(false);
    if (saveError || !data) {
      setError(saveError?.message ?? 'Could not save consultation pricing.');
      return;
    }
    setFeeUsd(feeFromDoctor(data));
    setCurrency(normalizeConsultationCurrency(data.consultation_currency));
    setSuccess('Consultation pricing updated.');
    onUpdated?.(data);
  };

  const currencySymbol = consultationCurrencySymbol(currency);

  return (
    <SectionCard title={title} subtitle={subtitle}>
      <form className='doctor-pricing-form' onSubmit={(e) => void handleSubmit(e)}>
        <p className='muted'>
          This charge is used for quotes and payment across patient, PSE, admin, and doctor views.
        </p>

        <label className='doctor-pricing-field doctor-pricing-field--currency'>
          <span>Currency</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(normalizeConsultationCurrency(e.target.value))}
            disabled={busy}
          >
            {CONSULTATION_CURRENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className='doctor-pricing-field'>
          <span>Consultation charge ({currencySymbol})</span>
          <input
            type='number'
            min={0}
            step={1}
            value={feeUsd}
            onChange={(e) => setFeeUsd(Math.max(0, Math.round(Number(e.target.value))))}
            disabled={busy}
          />
        </label>
        {error ? (
          <p className='auth-error' role='alert'>
            {error}
          </p>
        ) : null}
        {success ? (
          <p className='elixhealth-success' role='status'>
            {success}
          </p>
        ) : null}
        <button type='submit' className='primary-btn' disabled={busy || !doctorProfile}>
          {busy ? (
            <>
              <Loader2 size={16} className='spin' aria-hidden /> Saving…
            </>
          ) : (
            'Save pricing'
          )}
        </button>
      </form>
    </SectionCard>
  );
}

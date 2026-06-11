import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import SectionCard from '../../components/ui/SectionCard';
import {
  CONSULTATION_CURRENCY_OPTIONS,
  consultationCurrencySymbol,
  normalizeConsultationCurrency
} from '../../lib/consultationCurrency';
import { ensureStandardConsultationTiers, formatDurationMinutesLabel } from '../../lib/consultationTiers';
import { updateDoctorConsultationPricing } from '../../lib/doctors';
import type { ConsultationCurrency, ConsultationTier, Doctor } from '../../types/doctor';
import './doctor-pricing.css';

type DoctorConsultationPricingSectionProps = {
  doctorProfile: Doctor | null | undefined;
  onUpdated?: (doctor: Doctor) => void;
  title?: string;
  subtitle?: string;
};

function tiersFromDoctor(doctor: Doctor | null | undefined): ConsultationTier[] {
  const fallbackFee = doctor?.consultation_fee ?? doctor?.fee_usd ?? 0;
  if (!doctor?.consultation_tiers?.length) {
    return ensureStandardConsultationTiers([], fallbackFee);
  }
  return ensureStandardConsultationTiers(doctor.consultation_tiers, fallbackFee);
}

export default function DoctorConsultationPricingSection({
  doctorProfile,
  onUpdated,
  title = 'Consultation pricing',
  subtitle = 'Set fees for each session length you offer'
}: DoctorConsultationPricingSectionProps) {
  const [tiers, setTiers] = useState<ConsultationTier[]>(() => tiersFromDoctor(doctorProfile));
  const [currency, setCurrency] = useState<ConsultationCurrency>(() =>
    normalizeConsultationCurrency(doctorProfile?.consultation_currency)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setTiers(tiersFromDoctor(doctorProfile));
    setCurrency(normalizeConsultationCurrency(doctorProfile?.consultation_currency));
  }, [doctorProfile]);

  const setFee = (durationMinutes: number, feeUsd: number) => {
    setTiers((current) =>
      current.map((tier) =>
        tier.duration_minutes === durationMinutes
          ? { ...tier, fee_usd: Math.max(0, Math.round(feeUsd)) }
          : tier
      )
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    const { data, error: saveError } = await updateDoctorConsultationPricing(tiers, currency);
    setBusy(false);
    if (saveError || !data) {
      setError(saveError?.message ?? 'Could not save consultation pricing.');
      return;
    }
    setTiers(tiersFromDoctor(data));
    setCurrency(normalizeConsultationCurrency(data.consultation_currency));
    setSuccess('Consultation pricing updated.');
    onUpdated?.(data);
  };

  const currencySymbol = consultationCurrencySymbol(currency);

  return (
    <SectionCard title={title} subtitle={subtitle}>
      <form className='doctor-pricing-form' onSubmit={(e) => void handleSubmit(e)}>
        <p className='muted'>
          Patients choose a duration when requesting a second opinion. Set the charge for each length
          you offer — use 0 to hide a duration from patients.
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

        <div className='doctor-pricing-grid'>
          {tiers.map((tier) => (
            <label key={tier.duration_minutes} className='doctor-pricing-field'>
              <span>
                {formatDurationMinutesLabel(tier.duration_minutes)} ({currencySymbol})
              </span>
              <input
                type='number'
                min={0}
                step={1}
                value={tier.fee_usd}
                onChange={(e) => setFee(tier.duration_minutes, Number(e.target.value))}
                disabled={busy}
              />
            </label>
          ))}
        </div>
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

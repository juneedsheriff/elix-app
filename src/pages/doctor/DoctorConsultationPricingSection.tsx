import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import SectionCard from '../../components/ui/SectionCard';
import {
  ensureStandardConsultationTiers,
  primaryConsultationFeeFromTiers,
  tiersFromDualFees
} from '../../lib/consultationTiers';
import { updateDoctorConsultationPricing } from '../../lib/doctors';
import type { ConsultationTier, Doctor } from '../../types/doctor';
import './doctor-pricing.css';

type DoctorConsultationPricingSectionProps = {
  doctorProfile: Doctor | null | undefined;
  onUpdated?: (doctor: Doctor) => void;
  title?: string;
  subtitle?: string;
};

function feeFromDoctor(
  doctor: Doctor | null | undefined,
  currency: 'USD' | 'INR'
): number {
  if (!doctor) return 0;
  if (doctor.consultation_tiers?.length) {
    return primaryConsultationFeeFromTiers(
      ensureStandardConsultationTiers(
        doctor.consultation_tiers,
        doctor.consultation_fee ?? doctor.fee_usd ?? 0,
        doctor.consultation_fee_inr ?? 0
      ),
      currency
    );
  }
  if (currency === 'INR') {
    return Math.max(0, Math.round(doctor.consultation_fee_inr ?? 0));
  }
  return Math.max(0, Math.round(doctor.consultation_fee ?? doctor.fee_usd ?? 0));
}

export default function DoctorConsultationPricingSection({
  doctorProfile,
  onUpdated,
  title = 'Consultation pricing',
  subtitle = 'Set US Dollar and Indian Rupee charges. Patients see the fee for their clinic country.'
}: DoctorConsultationPricingSectionProps) {
  const [feeUsd, setFeeUsd] = useState(() => feeFromDoctor(doctorProfile, 'USD'));
  const [feeInr, setFeeInr] = useState(() => feeFromDoctor(doctorProfile, 'INR'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setFeeUsd(feeFromDoctor(doctorProfile, 'USD'));
    setFeeInr(feeFromDoctor(doctorProfile, 'INR'));
  }, [doctorProfile]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    const tiers: ConsultationTier[] = tiersFromDualFees(feeUsd, feeInr);
    const { data, error: saveError } = await updateDoctorConsultationPricing(tiers, 'USD');
    setBusy(false);
    if (saveError || !data) {
      setError(saveError?.message ?? 'Could not save consultation pricing.');
      return;
    }
    setFeeUsd(feeFromDoctor(data, 'USD'));
    setFeeInr(feeFromDoctor(data, 'INR'));
    setSuccess('Consultation pricing updated.');
    onUpdated?.(data);
  };

  return (
    <SectionCard title={title} subtitle={subtitle}>
      <form className='doctor-pricing-form' onSubmit={(e) => void handleSubmit(e)}>
        <p className='muted'>
          Enter both currencies. India clinic patients see Indian Rupees; other PSE countries see US
          Dollars.
        </p>

        <label className='doctor-pricing-field'>
          <span>Consultation charge (US Dollar $)</span>
          <input
            type='number'
            min={0}
            step={1}
            value={feeUsd}
            onChange={(e) => setFeeUsd(Math.max(0, Math.round(Number(e.target.value))))}
            disabled={busy}
          />
        </label>

        <label className='doctor-pricing-field'>
          <span>Consultation charge (Indian Rupee ₹)</span>
          <input
            type='number'
            min={0}
            step={1}
            value={feeInr}
            onChange={(e) => setFeeInr(Math.max(0, Math.round(Number(e.target.value))))}
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

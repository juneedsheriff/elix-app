import type { ConsultationTier, Doctor } from '../../types/doctor';
import {
  doctorConsultationCurrency,
  formatConsultationTierLabel,
  getOfferedConsultationTiers
} from '../../lib/consultationTiers';

type ConsultationTierPricingDisplayProps = {
  doctor: Pick<Doctor, 'consultation_tiers' | 'consultation_fee' | 'fee_usd' | 'consultation_currency'>;
  selectedDurationMinutes?: number | null;
  className?: string;
};

function feeForDuration(tiers: ConsultationTier[], durationMinutes?: number | null) {
  if (durationMinutes == null) return null;
  return tiers.find((tier) => tier.duration_minutes === durationMinutes) ?? null;
}

export default function ConsultationTierPricingDisplay({
  doctor,
  selectedDurationMinutes = null,
  className = ''
}: ConsultationTierPricingDisplayProps) {
  const tiers = getOfferedConsultationTiers(doctor);
  const selected = feeForDuration(tiers, selectedDurationMinutes);
  const currency = doctorConsultationCurrency(doctor);

  return (
    <div className={`consultation-tier-pricing${className ? ` ${className}` : ''}`}>
      {selected ? (
        <p className='consultation-tier-pricing__selected'>
          <strong>Consultation fee:</strong>{' '}
          {formatConsultationTierLabel(selected, { currency })}
        </p>
      ) : (
        <ul className='consultation-tier-pricing__list'>
          {tiers.map((tier) => (
            <li key={tier.duration_minutes}>{formatConsultationTierLabel(tier, { currency })}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

import type { ConsultationCurrency, Doctor } from '../../types/doctor';
import { formatConsultationFee } from '../../lib/consultationCurrency';
import {
  doctorConsultationCurrency,
  getPrimaryConsultationTier,
  tierFeeForCurrency
} from '../../lib/consultationTiers';

type ConsultationTierPricingDisplayProps = {
  doctor: Pick<
    Doctor,
    | 'consultation_tiers'
    | 'consultation_fee'
    | 'consultation_fee_inr'
    | 'fee_usd'
    | 'consultation_currency'
  >;
  className?: string;
  /** When set (from patient/PSE clinic), overrides doctor.consultation_currency. */
  displayCurrency?: ConsultationCurrency | null;
  /** Omit when a parent already labels the fee (e.g. profile grid “Consultation fee”). */
  showLabel?: boolean;
};

/** Shows the doctor's primary consultation charge only (no session duration). */
export default function ConsultationTierPricingDisplay({
  doctor,
  className = '',
  displayCurrency = null,
  showLabel = true
}: ConsultationTierPricingDisplayProps) {
  const primary = getPrimaryConsultationTier(doctor);
  const currency = displayCurrency
    ? displayCurrency
    : doctorConsultationCurrency(doctor);
  const fee = tierFeeForCurrency(primary, currency);

  if (!primary || fee <= 0) {
    return (
      <div className={`consultation-tier-pricing${className ? ` ${className}` : ''}`}>
        <p className='consultation-tier-pricing__selected muted'>Fee on request</p>
      </div>
    );
  }

  const amount = formatConsultationFee(fee, currency);

  return (
    <div className={`consultation-tier-pricing${className ? ` ${className}` : ''}`}>
      <p className='consultation-tier-pricing__selected'>
        {showLabel ? (
          <>
            <strong>Consultation fee:</strong> {amount}
          </>
        ) : (
          amount
        )}
      </p>
    </div>
  );
}

import type { Doctor } from '../../types/doctor';
import { formatConsultationFee } from '../../lib/consultationCurrency';
import {
  doctorConsultationCurrency,
  getPrimaryConsultationTier
} from '../../lib/consultationTiers';

type ConsultationTierPricingDisplayProps = {
  doctor: Pick<Doctor, 'consultation_tiers' | 'consultation_fee' | 'fee_usd' | 'consultation_currency'>;
  className?: string;
};

/** Shows the doctor's primary consultation charge only (no session duration). */
export default function ConsultationTierPricingDisplay({
  doctor,
  className = ''
}: ConsultationTierPricingDisplayProps) {
  const primary = getPrimaryConsultationTier(doctor);
  const currency = doctorConsultationCurrency(doctor);

  if (!primary || primary.fee_usd <= 0) {
    return (
      <div className={`consultation-tier-pricing${className ? ` ${className}` : ''}`}>
        <p className='consultation-tier-pricing__selected muted'>Fee on request</p>
      </div>
    );
  }

  return (
    <div className={`consultation-tier-pricing${className ? ` ${className}` : ''}`}>
      <p className='consultation-tier-pricing__selected'>
        <strong>Consultation fee:</strong> {formatConsultationFee(primary.fee_usd, currency)}
      </p>
    </div>
  );
}

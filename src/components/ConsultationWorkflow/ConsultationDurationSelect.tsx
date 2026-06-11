import type { ConsultationCurrency, ConsultationTier } from '../../types/doctor';
import { formatConsultationTierLabel } from '../../lib/consultationTiers';
import { normalizeConsultationCurrency } from '../../lib/consultationCurrency';
import './consultation-duration-select.css';

type ConsultationDurationSelectProps = {
  tiers: ConsultationTier[];
  value: number | null;
  onChange: (durationMinutes: number) => void;
  disabled?: boolean;
  label?: string;
  name?: string;
  hint?: string;
  showFees?: boolean;
  currency?: ConsultationCurrency;
};

export default function ConsultationDurationSelect({
  tiers,
  value,
  onChange,
  disabled = false,
  label = 'Consultation duration',
  name = 'consultation-duration',
  hint,
  showFees = true,
  currency = 'USD'
}: ConsultationDurationSelectProps) {
  const resolvedCurrency = normalizeConsultationCurrency(currency);
  const options = tiers.filter((tier) => (showFees ? tier.fee_usd > 0 : true));
  if (!options.length) return null;

  return (
    <fieldset className='consultation-duration-select' disabled={disabled}>
      <legend>{label}</legend>
      {hint ? <p className='muted consultation-duration-select__hint'>{hint}</p> : null}
      <div className='consultation-duration-select__options' role='radiogroup' aria-label={label}>
        {options.map((tier) => {
          const id = `${name}-${tier.duration_minutes}`;
          const isSelected = value === tier.duration_minutes;
          return (
            <label
              key={tier.duration_minutes}
              className={
                isSelected
                  ? 'consultation-duration-select__option consultation-duration-select__option--selected'
                  : 'consultation-duration-select__option'
              }
              htmlFor={id}
            >
              <input
                id={id}
                type='radio'
                name={name}
                checked={isSelected}
                onChange={() => onChange(tier.duration_minutes)}
              />
              <span className='consultation-duration-select__label'>
                {formatConsultationTierLabel(tier, { showFee: showFees, currency: resolvedCurrency })}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

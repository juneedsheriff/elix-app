import { useEffect, useState, type ReactNode } from 'react';
import { Check, Home, Loader2, X } from 'lucide-react';
import {
  HOME_CARE_SERVICE_OPTIONS,
  type HomeCareServiceId,
  type HomeCareServiceSelection
} from '../../lib/homeCareServices';
import './patient-my-requests.css';

type HomeCareServicesModalProps = {
  open: boolean;
  onClose: () => void;
  onContinue: (selection: HomeCareServiceSelection) => void | Promise<void>;
  busy?: boolean;
  error?: string | null;
  /** Optional content above the category list (e.g. Clinic PSE patient picker). */
  headerSlot?: ReactNode;
};

export default function HomeCareServicesModal({
  open,
  onClose,
  onContinue,
  busy = false,
  error = null,
  headerSlot
}: HomeCareServicesModalProps) {
  const [selected, setSelected] = useState<Set<HomeCareServiceId>>(new Set());
  const [otherNote, setOtherNote] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setOtherNote('');
    setLocalError(null);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, busy]);

  if (!open) return null;

  const toggle = (id: HomeCareServiceId) => {
    setLocalError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (id === 'others') setOtherNote('');
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleContinue = () => {
    const selection: HomeCareServiceSelection = {
      serviceIds: HOME_CARE_SERVICE_OPTIONS.map((option) => option.id).filter((id) =>
        selected.has(id)
      ),
      otherNote
    };

    if (!selection.serviceIds.length) {
      setLocalError('Select at least one home care service.');
      return;
    }
    if (selection.serviceIds.includes('others') && !otherNote.trim()) {
      setLocalError('Please describe the other home care service needed.');
      return;
    }

    void onContinue(selection);
  };

  const displayError = error || localError;

  return (
    <div className='second-opinion-modal-root' role='presentation'>
      <button
        type='button'
        className='second-opinion-modal-backdrop'
        onClick={() => {
          if (!busy) onClose();
        }}
        aria-label='Close home care services'
      />
      <div
        className='second-opinion-modal home-care-services-modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='home-care-services-modal-title'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='second-opinion-modal-head'>
          <div>
            <h2 id='home-care-services-modal-title'>Home Care Services</h2>
            <p className='muted'>Choose one or more services you need. Your clinic team will coordinate next steps.</p>
          </div>
          <button
            type='button'
            className='icon-btn second-opinion-modal-close'
            onClick={onClose}
            disabled={busy}
            aria-label='Close'
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className='second-opinion-modal-body'>
          {headerSlot}

          <div className='home-care-services-list' role='group' aria-label='Home care service categories'>
            {HOME_CARE_SERVICE_OPTIONS.map((option) => {
              const isChecked = selected.has(option.id);
              return (
                <label
                  key={option.id}
                  className={`home-care-service-option${isChecked ? ' home-care-service-option--selected' : ''}`}
                >
                  <span className='home-care-service-option__check' aria-hidden>
                    {isChecked ? <Check size={16} strokeWidth={2.5} /> : null}
                  </span>
                  <input
                    type='checkbox'
                    className='sr-only'
                    checked={isChecked}
                    disabled={busy}
                    onChange={() => toggle(option.id)}
                  />
                  <span className='home-care-service-option__label'>{option.label}</span>
                </label>
              );
            })}
          </div>

          {selected.has('others') ? (
            <label className='home-care-other-field'>
              <span>Describe other service</span>
              <textarea
                value={otherNote}
                onChange={(event) => {
                  setLocalError(null);
                  setOtherNote(event.target.value);
                }}
                rows={3}
                placeholder='Tell us what home care support you need…'
                disabled={busy}
              />
            </label>
          ) : null}

          {displayError ? (
            <p className='auth-error' role='alert'>
              {displayError}
            </p>
          ) : null}
        </div>

        <div className='home-care-services-modal__footer'>
          <button type='button' className='text-btn' onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type='button'
            className='primary-btn'
            onClick={handleContinue}
            disabled={busy || selected.size === 0}
          >
            {busy ? (
              <>
                <Loader2 size={16} className='spin' aria-hidden /> Submitting…
              </>
            ) : (
              <>
                <Home size={16} aria-hidden /> Continue
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

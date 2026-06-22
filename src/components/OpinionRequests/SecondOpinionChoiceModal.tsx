import { useEffect } from 'react';
import { Search, Users, X } from 'lucide-react';
import './patient-my-requests.css';

type SecondOpinionChoiceModalProps = {
  open: boolean;
  onClose: () => void;
  onSelfSelect: () => void;
  onGetRecommendations: () => void;
};

export default function SecondOpinionChoiceModal({
  open,
  onClose,
  onSelfSelect,
  onGetRecommendations
}: SecondOpinionChoiceModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className='second-opinion-modal-root' role='presentation'>
      <button
        type='button'
        className='second-opinion-modal-backdrop'
        onClick={onClose}
        aria-label='Close doctor consultation options'
      />
      <div
        className='second-opinion-modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='second-opinion-modal-title'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='second-opinion-modal-head'>
          <div>
            <h2 id='second-opinion-modal-title'>Choose your doctor consultation option</h2>
            <p className='muted'>Select how you would like to proceed with your consultation request.</p>
          </div>
          <button type='button' className='icon-btn second-opinion-modal-close' onClick={onClose} aria-label='Close'>
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className='second-opinion-modal-body'>
          <button type='button' className='second-opinion-option' onClick={onSelfSelect}>
            <span className='second-opinion-option__icon' aria-hidden>
              <Search size={22} />
            </span>
            <span className='second-opinion-option__content'>
              <strong>1. Self-select a doctor</strong>
              <span className='second-opinion-option__help'>
              Browse specialists, choose your doctor, upload records, and submit your request.
              </span>
            </span>
          </button>

          <button type='button' className='second-opinion-option' onClick={onGetRecommendations}>
            <span className='second-opinion-option__icon' aria-hidden>
              <Users size={22} />
            </span>
            <span className='second-opinion-option__content'>
              <strong>2. Get doctor recommendations</strong>
              <span className='second-opinion-option__help'>
              Submit your records and case details. Our PSE team will recommend suitable specialists.
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

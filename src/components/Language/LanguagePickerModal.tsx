import { useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { LANGUAGE_OPTIONS, type Language } from '../../i18n/appTranslations';

type LanguagePickerModalProps = {
  open: boolean;
  current: Language;
  title: string;
  closeLabel: string;
  onClose: () => void;
  onSelect: (language: Language) => void;
};

export default function LanguagePickerModal({
  open,
  current,
  title,
  closeLabel,
  onClose,
  onSelect
}: LanguagePickerModalProps) {
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
    <div className='lang-modal-root' role='presentation'>
      <button type='button' className='lang-modal-backdrop' onClick={onClose} aria-label={closeLabel} />
      <div
        className='lang-modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='lang-modal-title'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='lang-modal-head'>
          <h2 id='lang-modal-title'>{title}</h2>
          <button type='button' className='icon-btn lang-modal-close' onClick={onClose} aria-label={closeLabel}>
            <X size={20} aria-hidden />
          </button>
        </div>
        <ul className='lang-modal-list' role='listbox' aria-label={title}>
          {LANGUAGE_OPTIONS.map((option) => {
            const selected = option.code === current;
            return (
              <li key={option.code}>
                <button
                  type='button'
                  role='option'
                  aria-selected={selected}
                  className={`lang-option ${selected ? 'lang-option-active' : ''}`}
                  onClick={() => {
                    onSelect(option.code);
                    onClose();
                  }}
                >
                  <span className='lang-option-text'>
                    <strong>{option.native}</strong>
                    <span>{option.label}</span>
                  </span>
                  {selected ? <Check size={20} strokeWidth={2.5} aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

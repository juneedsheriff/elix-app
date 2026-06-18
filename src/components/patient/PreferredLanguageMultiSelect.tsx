import { X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { filterPreferredLanguageSuggestions, normalizePreferredLanguagePart } from '../../lib/patientProfileOptions';
import './patient-preferred-language-multi-select.css';

type PreferredLanguageMultiSelectProps = {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  label?: string;
};

export default function PreferredLanguageMultiSelect({
  value,
  onChange,
  disabled = false,
  label = 'Preferred languages'
}: PreferredLanguageMultiSelectProps) {
  const inputId = useId();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const suggestions = useMemo(
    () => filterPreferredLanguageSuggestions(query, value),
    [query, value]
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const addLanguage = (raw: string) => {
    const normalized = normalizePreferredLanguagePart(raw);
    if (!normalized) return;
    const exists = value.some((language) => language.toLowerCase() === normalized.toLowerCase());
    if (exists) {
      setQuery('');
      setActiveIndex(-1);
      return;
    }
    onChange([...value, normalized]);
    setQuery('');
    setActiveIndex(-1);
    setOpen(true);
    inputRef.current?.focus();
  };

  const removeLanguage = (language: string) => {
    onChange(value.filter((item) => item !== language));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        addLanguage(suggestions[activeIndex]);
        return;
      }
      if (query.trim()) {
        addLanguage(query);
      }
      return;
    }

    if (event.key === 'Backspace' && !query && value.length > 0) {
      onChange(value.slice(0, -1));
    }

    if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className='patient-language-multi' ref={rootRef}>
      <label className='patient-language-multi__label' htmlFor={inputId}>
        {label}
      </label>
      <div
        className={`patient-language-multi__control ${open ? 'patient-language-multi__control--open' : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((language) => (
          <span key={language} className='patient-language-multi__chip'>
            {language}
            <button
              type='button'
              className='patient-language-multi__chip-remove'
              onClick={(event) => {
                event.stopPropagation();
                removeLanguage(language);
              }}
              disabled={disabled}
              aria-label={`Remove ${language}`}
            >
              <X size={12} aria-hidden />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={inputId}
          className='patient-language-multi__input'
          type='text'
          role='combobox'
          aria-autocomplete='list'
          aria-expanded={open}
          aria-controls={listboxId}
          autoComplete='off'
          value={query}
          disabled={disabled}
          placeholder={value.length ? 'Add another language…' : 'Type or select languages'}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {open && suggestions.length > 0 ? (
        <ul className='patient-language-multi__suggestions' id={listboxId} role='listbox'>
          {suggestions.map((language, index) => (
            <li key={language} role='presentation'>
              <button
                type='button'
                role='option'
                aria-selected={index === activeIndex}
                className={
                  index === activeIndex
                    ? 'patient-language-multi__option patient-language-multi__option--active'
                    : 'patient-language-multi__option'
                }
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addLanguage(language)}
              >
                {language}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className='patient-language-multi__hint'>Select multiple languages. Press Enter or comma to add.</p>
    </div>
  );
}

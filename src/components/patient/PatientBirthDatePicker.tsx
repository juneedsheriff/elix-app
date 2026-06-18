import dayjs from 'dayjs';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import './patient-birth-date-picker.css';

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

type PatientBirthDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  minDate?: string;
  maxDate?: string;
  placeholder?: string;
};

function formatDisplayDate(value: string, placeholder: string): string {
  if (!value) return placeholder;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('MMM D, YYYY') : placeholder;
}

export default function PatientBirthDatePicker({
  value,
  onChange,
  disabled = false,
  label = 'Date of birth',
  minDate: minDateProp,
  maxDate: maxDateProp,
  placeholder = 'Select date of birth'
}: PatientBirthDatePickerProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() =>
    value && dayjs(value).isValid() ? dayjs(value).startOf('month') : dayjs().subtract(25, 'year').startOf('month')
  );

  const maxDate = maxDateProp ?? dayjs().format('YYYY-MM-DD');
  const minDate = minDateProp ?? dayjs().subtract(120, 'year').format('YYYY-MM-DD');

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (value && dayjs(value).isValid()) {
      setViewMonth(dayjs(value).startOf('month'));
    }
  }, [value]);

  const calendarDays = useMemo(() => {
    const start = viewMonth.startOf('month');
    const end = viewMonth.endOf('month');
    const gridStart = start.startOf('week');
    const gridEnd = end.endOf('week');
    const days: dayjs.Dayjs[] = [];
    let cursor = gridStart;
    while (cursor.isBefore(gridEnd) || cursor.isSame(gridEnd, 'day')) {
      days.push(cursor);
      cursor = cursor.add(1, 'day');
    }
    return days;
  }, [viewMonth]);

  const openPicker = () => {
    if (disabled) return;
    if (typeof nativeInputRef.current?.showPicker === 'function') {
      nativeInputRef.current.showPicker();
      return;
    }
    setOpen((current) => !current);
  };

  const selectDate = (date: dayjs.Dayjs) => {
    if (date.isAfter(dayjs(maxDate), 'day') || date.isBefore(dayjs(minDate), 'day')) return;
    onChange(date.format('YYYY-MM-DD'));
    setOpen(false);
  };

  return (
    <div className='patient-birth-date-picker' ref={rootRef}>
      <span className='patient-birth-date-picker__label'>{label}</span>
      <div className='patient-birth-date-picker__control'>
        <button
          type='button'
          className='patient-birth-date-picker__trigger'
          onClick={openPicker}
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup='dialog'
          aria-controls={listboxId}
        >
          <Calendar size={16} aria-hidden />
          <span className={value ? '' : 'patient-birth-date-picker__placeholder'}>
            {formatDisplayDate(value, placeholder)}
          </span>
        </button>
        <input
          ref={nativeInputRef}
          type='date'
          className='patient-birth-date-picker__native'
          value={value}
          min={minDate}
          max={maxDate}
          disabled={disabled}
          aria-label={label}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(false);
          }}
        />
      </div>

      {open ? (
        <div className='patient-birth-date-picker__popover' id={listboxId} role='dialog' aria-label={label}>
          <div className='patient-birth-date-picker__header'>
            <button
              type='button'
              className='patient-birth-date-picker__nav'
              onClick={() => setViewMonth((month) => month.subtract(1, 'month'))}
              aria-label='Previous month'
            >
              <ChevronLeft size={16} aria-hidden />
            </button>
            <p className='patient-birth-date-picker__month'>{viewMonth.format('MMMM YYYY')}</p>
            <button
              type='button'
              className='patient-birth-date-picker__nav'
              onClick={() => setViewMonth((month) => month.add(1, 'month'))}
              aria-label='Next month'
            >
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
          <div className='patient-birth-date-picker__weekdays'>
            {WEEKDAY_LABELS.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>
          <div className='patient-birth-date-picker__grid'>
            {calendarDays.map((day) => {
              const iso = day.format('YYYY-MM-DD');
              const isSelected = value === iso;
              const isOutside = !day.isSame(viewMonth, 'month');
              const isDisabled =
                day.isAfter(dayjs(maxDate), 'day') || day.isBefore(dayjs(minDate), 'day');

              return (
                <button
                  key={iso}
                  type='button'
                  className={[
                    'patient-birth-date-picker__day',
                    isOutside ? 'patient-birth-date-picker__day--outside' : '',
                    isSelected ? 'patient-birth-date-picker__day--selected' : '',
                    isDisabled ? 'patient-birth-date-picker__day--disabled' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => selectDate(day)}
                  disabled={isDisabled}
                  aria-pressed={isSelected}
                >
                  {day.date()}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

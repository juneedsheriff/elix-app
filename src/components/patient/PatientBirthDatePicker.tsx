import dayjs from 'dayjs';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  /** Birth dates open near a typical adult age. Other dates open on the current month. */
  focusMonth?: 'today' | 'birth';
};

function formatDisplayDate(value: string, placeholder: string): string {
  if (!value) return placeholder;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('MMM D, YYYY') : placeholder;
}

function clampMonth(month: dayjs.Dayjs, minDate: string, maxDate: string) {
  const min = dayjs(minDate).startOf('month');
  const max = dayjs(maxDate).startOf('month');
  if (month.isBefore(min, 'month')) return min;
  if (month.isAfter(max, 'month')) return max;
  return month.startOf('month');
}

function resolveViewMonth(
  value: string,
  minDate: string,
  maxDate: string,
  focusMonth: 'today' | 'birth'
) {
  if (value && dayjs(value).isValid()) {
    return clampMonth(dayjs(value), minDate, maxDate);
  }
  const anchor = focusMonth === 'birth' ? dayjs().subtract(25, 'year') : dayjs();
  return clampMonth(anchor, minDate, maxDate);
}

export default function PatientBirthDatePicker({
  value,
  onChange,
  disabled = false,
  label = 'Date of birth',
  minDate: minDateProp,
  maxDate: maxDateProp,
  placeholder = 'Select date of birth',
  focusMonth = 'today'
}: PatientBirthDatePickerProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const openedAtRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [backdropActive, setBackdropActive] = useState(false);
  const maxDate = maxDateProp ?? dayjs().format('YYYY-MM-DD');
  const minDate = minDateProp ?? dayjs().subtract(120, 'year').format('YYYY-MM-DD');
  const [viewMonth, setViewMonth] = useState(() => resolveViewMonth(value, minDate, maxDate, focusMonth));

  const closePicker = () => {
    if (performance.now() - openedAtRef.current < 450) return;
    setOpen(false);
  };

  const openPicker = () => {
    if (disabled) return;
    const now = performance.now();
    if (open) {
      closePicker();
      return;
    }
    if (now - openedAtRef.current < 450) return;
    openedAtRef.current = now;
    setViewMonth(resolveViewMonth(value, minDate, maxDate, focusMonth));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) {
      setBackdropActive(false);
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const backdropTimer = window.setTimeout(() => setBackdropActive(true), 450);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(backdropTimer);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (value && dayjs(value).isValid()) {
      setViewMonth(clampMonth(dayjs(value), minDate, maxDate));
    }
  }, [value, minDate, maxDate]);

  useLayoutEffect(() => {
    if (!open) return;
    const popover = popoverRef.current;
    const anchor = rootRef.current?.getBoundingClientRect();
    if (!popover || !anchor) return;

    const place = () => {
      const nextAnchor = rootRef.current?.getBoundingClientRect();
      if (!nextAnchor) return;
      const margin = 8;
      const width = Math.min(288, window.innerWidth - margin * 2);
      let left = nextAnchor.left;
      if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width;
      if (left < margin) left = margin;
      const height = popover.offsetHeight;
      const spaceBelow = window.innerHeight - nextAnchor.bottom;
      const top =
        spaceBelow < height + 12 && nextAnchor.top > height + 12
          ? nextAnchor.top - height - 6
          : Math.min(nextAnchor.bottom + 6, Math.max(margin, window.innerHeight - height - margin));
      popover.style.top = `${Math.max(margin, top)}px`;
      popover.style.left = `${left}px`;
      popover.style.width = `${width}px`;
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, viewMonth]);

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

  const selectDate = (date: dayjs.Dayjs) => {
    if (date.isAfter(dayjs(maxDate), 'day') || date.isBefore(dayjs(minDate), 'day')) return;
    onChange(date.format('YYYY-MM-DD'));
    setOpen(false);
  };

  const canGoPrev = viewMonth.isAfter(dayjs(minDate).startOf('month'), 'month');
  const canGoNext = viewMonth.isBefore(dayjs(maxDate).startOf('month'), 'month');

  const popover =
    open && typeof document !== 'undefined'
      ? createPortal(
          <>
            <button
              type='button'
              className='patient-birth-date-picker__backdrop'
              aria-label='Close date picker'
              style={{ pointerEvents: backdropActive ? 'auto' : 'none' }}
              onClick={closePicker}
            />
            <div
              ref={popoverRef}
              className='patient-birth-date-picker__popover'
              id={listboxId}
              role='dialog'
              aria-label={label}
            >
              <div className='patient-birth-date-picker__header'>
                <button
                  type='button'
                  className='patient-birth-date-picker__nav'
                  onClick={() => setViewMonth((month) => month.subtract(1, 'month'))}
                  disabled={!canGoPrev}
                  aria-label='Previous month'
                >
                  <ChevronLeft size={16} aria-hidden />
                </button>
                <p className='patient-birth-date-picker__month'>{viewMonth.format('MMMM YYYY')}</p>
                <button
                  type='button'
                  className='patient-birth-date-picker__nav'
                  onClick={() => setViewMonth((month) => month.add(1, 'month'))}
                  disabled={!canGoNext}
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
          </>,
          document.body
        )
      : null;

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
      </div>
      {popover}
    </div>
  );
}

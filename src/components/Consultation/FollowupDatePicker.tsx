import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { localIsoDate } from '../../lib/consultationSummaryFields';
import './followup-date-picker.css';

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'] as const;
const MAX_YEARS_AHEAD = 10;

type FollowupDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

function parseIso(value: string): Date | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatIso(date: Date): string {
  return localIsoDate(date);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isBeforeDay(a: Date, b: Date): boolean {
  return formatIso(a) < formatIso(b);
}

function displayValue(value: string): string {
  const date = parseIso(value);
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day} / ${month} / ${date.getFullYear()}`;
}

function allowedMonthsForYear(year: number, minDate: Date): number[] {
  const months: number[] = [];
  for (let month = 0; month < 12; month += 1) {
    const monthEnd = new Date(year, month + 1, 0);
    if (!isBeforeDay(monthEnd, minDate)) months.push(month);
  }
  return months;
}

export default function FollowupDatePicker({ value, onChange, disabled = false }: FollowupDatePickerProps) {
  const dialogId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const minIso = localIsoDate();
  const minDate = parseIso(minIso) ?? new Date();
  const maxYear = minDate.getFullYear() + MAX_YEARS_AHEAD;
  const selected = parseIso(value);
  const [open, setOpen] = useState(false);
  const [monthYearOpen, setMonthYearOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected && !isBeforeDay(selected, minDate) ? selected : minDate));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setMonthYearOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (selected && !isBeforeDay(selected, minDate)) {
      setViewMonth(startOfMonth(selected));
    }
  }, [selected, minIso]);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let year = minDate.getFullYear(); year <= maxYear; year += 1) list.push(year);
    return list;
  }, [minDate, maxYear]);

  const months = useMemo(
    () => allowedMonthsForYear(viewMonth.getFullYear(), minDate),
    [viewMonth, minDate]
  );

  const calendarDays = useMemo(() => {
    const start = startOfMonth(viewMonth);
    const gridStart = new Date(start);
    gridStart.setDate(1 - start.getDay());
    const days: Date[] = [];
    for (let i = 0; i < 42; i += 1) {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + i);
      days.push(day);
    }
    return days;
  }, [viewMonth]);

  const canGoPrev = addMonths(viewMonth, -1).getTime() >= startOfMonth(minDate).getTime();
  const canGoNext = viewMonth.getFullYear() < maxYear || viewMonth.getMonth() < 11;

  const selectDate = (date: Date) => {
    if (isBeforeDay(date, minDate)) return;
    onChange(formatIso(date));
    setOpen(false);
    setMonthYearOpen(false);
  };

  const setViewYear = (year: number) => {
    const allowed = allowedMonthsForYear(year, minDate);
    const nextMonth = allowed.includes(viewMonth.getMonth()) ? viewMonth.getMonth() : (allowed[0] ?? 0);
    setViewMonth(new Date(year, nextMonth, 1));
  };

  return (
    <div className='followup-date-picker' ref={rootRef}>
      <button
        type='button'
        className='followup-date-picker__trigger doctor-respond-date'
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
          setMonthYearOpen(false);
        }}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup='dialog'
        aria-controls={dialogId}
      >
        <span className={value ? '' : 'followup-date-picker__placeholder'}>
          {displayValue(value) || 'dd / mm / yyyy'}
        </span>
        <Calendar size={16} aria-hidden />
      </button>

      {open ? (
        <div className='followup-date-picker__popover' id={dialogId} role='dialog' aria-label='Follow-up Date'>
          <div className='followup-date-picker__header'>
            <button
              type='button'
              className='followup-date-picker__nav'
              onClick={() => setViewMonth((month) => addMonths(month, -1))}
              disabled={!canGoPrev}
              aria-label='Previous month'
            >
              <ChevronLeft size={16} aria-hidden />
            </button>
            <button
              type='button'
              className='followup-date-picker__month-btn'
              onClick={() => setMonthYearOpen((current) => !current)}
              aria-expanded={monthYearOpen}
            >
              {MONTH_LABELS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
              <ChevronDown size={14} aria-hidden />
            </button>
            <button
              type='button'
              className='followup-date-picker__nav'
              onClick={() => setViewMonth((month) => addMonths(month, 1))}
              disabled={!canGoNext}
              aria-label='Next month'
            >
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>

          {monthYearOpen ? (
            <div className='followup-date-picker__month-year'>
              <div className='followup-date-picker__col' role='listbox' aria-label='Month'>
                {months.map((month) => (
                  <button
                    key={month}
                    type='button'
                    role='option'
                    aria-selected={month === viewMonth.getMonth()}
                    className={`followup-date-picker__option${
                      month === viewMonth.getMonth() ? ' followup-date-picker__option--selected' : ''
                    }`}
                    onClick={() => {
                      setViewMonth(new Date(viewMonth.getFullYear(), month, 1));
                      setMonthYearOpen(false);
                    }}
                  >
                    {MONTH_LABELS[month]}
                  </button>
                ))}
              </div>
              <div className='followup-date-picker__col' role='listbox' aria-label='Year'>
                {years.map((year) => (
                  <button
                    key={year}
                    type='button'
                    role='option'
                    aria-selected={year === viewMonth.getFullYear()}
                    className={`followup-date-picker__option${
                      year === viewMonth.getFullYear() ? ' followup-date-picker__option--selected' : ''
                    }`}
                    onClick={() => {
                      setViewYear(year);
                      setMonthYearOpen(false);
                    }}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className='followup-date-picker__weekdays'>
                {WEEKDAY_LABELS.map((weekday) => (
                  <span key={weekday}>{weekday}</span>
                ))}
              </div>
              <div className='followup-date-picker__grid'>
                {calendarDays.map((day) => {
                  const iso = formatIso(day);
                  const isSelected = Boolean(selected && isSameDay(day, selected));
                  const isOutside = day.getMonth() !== viewMonth.getMonth();
                  const isDisabled = isBeforeDay(day, minDate);

                  return (
                    <button
                      key={iso}
                      type='button'
                      className={[
                        'followup-date-picker__day',
                        isOutside ? 'followup-date-picker__day--outside' : '',
                        isSelected ? 'followup-date-picker__day--selected' : '',
                        isDisabled ? 'followup-date-picker__day--disabled' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => selectDate(day)}
                      disabled={isDisabled}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Copy, Plus, X } from 'lucide-react';
import type {
  ConsultationHours,
  ConsultationHoursDay,
  ConsultationHoursInterval
} from '../../../types/doctor';
import './consultation-hours-editor.css';

const DAYS: { key: keyof ConsultationHours; label: string; fullLabel: string }[] = [
  { key: 'monday', label: 'Mon', fullLabel: 'Monday' },
  { key: 'tuesday', label: 'Tue', fullLabel: 'Tuesday' },
  { key: 'wednesday', label: 'Wed', fullLabel: 'Wednesday' },
  { key: 'thursday', label: 'Thu', fullLabel: 'Thursday' },
  { key: 'friday', label: 'Fri', fullLabel: 'Friday' },
  { key: 'saturday', label: 'Sat', fullLabel: 'Saturday' },
  { key: 'sunday', label: 'Sun', fullLabel: 'Sunday' }
];

const ALL_DAY_KEYS = DAYS.map((day) => day.key);

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? 0 : 30;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function isValidIntervalRange(interval: ConsultationHoursInterval): boolean {
  return timeToMinutes(interval.start) < timeToMinutes(interval.end);
}

function intervalsOverlap(
  left: ConsultationHoursInterval,
  right: ConsultationHoursInterval
): boolean {
  const leftStart = timeToMinutes(left.start);
  const leftEnd = timeToMinutes(left.end);
  const rightStart = timeToMinutes(right.start);
  const rightEnd = timeToMinutes(right.end);
  return leftStart < rightEnd && rightStart < leftEnd;
}

function validateDayIntervals(intervals: ConsultationHoursInterval[]): string | null {
  for (let index = 0; index < intervals.length; index += 1) {
    if (!isValidIntervalRange(intervals[index])) {
      return `Slot ${index + 1}: end time must be after start time.`;
    }
  }

  for (let left = 0; left < intervals.length; left += 1) {
    for (let right = left + 1; right < intervals.length; right += 1) {
      if (intervalsOverlap(intervals[left], intervals[right])) {
        return `Slots ${left + 1} and ${right + 1} overlap. Use separate, non-conflicting hours on the same day.`;
      }
    }
  }

  return null;
}

function suggestedNextInterval(
  intervals: ConsultationHoursInterval[]
): ConsultationHoursInterval | null {
  const last = intervals[intervals.length - 1];
  if (!last) return { start: '09:00', end: '17:00' };

  const lastEnd = timeToMinutes(last.end);
  const nextStartOption = TIME_OPTIONS.find((time) => timeToMinutes(time) >= lastEnd);
  if (!nextStartOption) return null;

  const nextStartMinutes = timeToMinutes(nextStartOption);
  const nextEndOption =
    TIME_OPTIONS.find((time) => timeToMinutes(time) > nextStartMinutes) ??
    TIME_OPTIONS[TIME_OPTIONS.length - 1];

  if (timeToMinutes(nextEndOption) <= nextStartMinutes) return null;

  const candidate = { start: nextStartOption, end: nextEndOption };
  const combined = [...intervals, candidate];
  return validateDayIntervals(combined) ? null : candidate;
}

function joinClasses(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(' ');
}

function formatTimeLabel(time: string) {
  return dayjs(`2000-01-01T${time}`).format('h:mm A');
}

function dayIntervals(day: ConsultationHoursDay): ConsultationHoursInterval[] {
  if (!day.enabled) return [];
  if (day.intervals?.length) return day.intervals.map((interval) => ({ ...interval }));
  return [{ start: day.start, end: day.end }];
}

function normalizeDay(day: ConsultationHoursDay): ConsultationHoursDay {
  if (!day.enabled) {
    return {
      ...day,
      intervals: day.intervals?.map((interval) => ({ ...interval }))
    };
  }
  const intervals = dayIntervals(day);
  return {
    ...day,
    enabled: true,
    start: intervals[0]?.start ?? day.start,
    end: intervals[0]?.end ?? day.end,
    intervals
  };
}

function cloneConsultationDay(day: ConsultationHoursDay): ConsultationHoursDay {
  const intervals = dayIntervals(day).map((interval) => ({ ...interval }));
  return {
    enabled: day.enabled,
    start: intervals[0]?.start ?? day.start,
    end: intervals[0]?.end ?? day.end,
    intervals: day.enabled ? intervals : undefined
  };
}

function buildDayFromMondayTemplate(template: ConsultationHoursDay): ConsultationHoursDay | null {
  if (!template.enabled) return null;
  const intervals = dayIntervals(template).map((interval) => ({ ...interval }));
  return {
    enabled: true,
    start: intervals[0]?.start ?? '09:00',
    end: intervals[0]?.end ?? '17:00',
    intervals: intervals.map((interval) => ({ ...interval }))
  };
}

function mondayTemplateFromValue(hours: ConsultationHours): ConsultationHoursDay | null {
  const monday = hours.monday;
  const source =
    monday.enabled || !monday.intervals?.length
      ? monday
      : { ...monday, enabled: true, intervals: monday.intervals };
  return buildDayFromMondayTemplate(normalizeDay(source));
}

function mondayHasConfiguredHours(hours: ConsultationHours): boolean {
  const monday = hours.monday;
  if (monday.enabled) return true;
  return Boolean(monday.intervals?.length || (monday.start && monday.end));
}

type ConsultationHoursEditorProps = {
  value: ConsultationHours;
  onChange: (value: ConsultationHours) => void;
};

export default function ConsultationHoursEditor({ value, onChange }: ConsultationHoursEditorProps) {
  const [dayErrors, setDayErrors] = useState<Partial<Record<keyof ConsultationHours, string>>>({});

  useEffect(() => {
    const next: Partial<Record<keyof ConsultationHours, string>> = {};
    for (const { key } of DAYS) {
      const day = value[key];
      if (!day.enabled) continue;
      const error = validateDayIntervals(dayIntervals(day));
      if (error) next[key] = error;
    }
    setDayErrors(next);
  }, [value]);

  const setDay = (key: keyof ConsultationHours, day: ConsultationHoursDay) => {
    const normalized = normalizeDay(day);
    const error = normalized.enabled ? validateDayIntervals(dayIntervals(normalized)) : null;
    setDayErrors((current) => ({ ...current, [key]: error ?? undefined }));
    if (error) return;

    onChange({
      ...value,
      [key]: normalized
    });
  };

  const tryUpdateDayIntervals = (
    key: keyof ConsultationHours,
    intervals: ConsultationHoursInterval[]
  ) => {
    const current = normalizeDay(value[key]);
    const error = validateDayIntervals(intervals);
    if (error) {
      setDayErrors((currentErrors) => ({ ...currentErrors, [key]: error }));
      return;
    }

    setDayErrors((currentErrors) => ({ ...currentErrors, [key]: undefined }));
    onChange({
      ...value,
      [key]: normalizeDay({ ...current, enabled: true, intervals })
    });
  };

  const toggleDay = (key: keyof ConsultationHours, enabled: boolean) => {
    const current = value[key];
    if (!enabled) {
      const intervals = dayIntervals({ ...current, enabled: true });
      setDayErrors((currentErrors) => ({ ...currentErrors, [key]: undefined }));
      onChange({
        ...value,
        [key]: normalizeDay({
          ...current,
          enabled: false,
          start: intervals[0]?.start ?? current.start,
          end: intervals[0]?.end ?? current.end,
          intervals: intervals.length ? intervals : current.intervals
        })
      });
      return;
    }
    const restored =
      current.intervals?.map((interval) => ({ ...interval })) ??
      (current.start && current.end ? [{ start: current.start, end: current.end }] : []);
    setDay(key, {
      ...current,
      enabled: true,
      intervals: restored.length ? restored : [{ start: '09:00', end: '17:00' }]
    });
  };

  const updateInterval = (
    key: keyof ConsultationHours,
    index: number,
    patch: Partial<ConsultationHoursInterval>
  ) => {
    const current = normalizeDay(value[key]);
    const intervals = dayIntervals(current).map((interval, i) =>
      i === index ? { ...interval, ...patch } : interval
    );
    tryUpdateDayIntervals(key, intervals);
  };

  const addInterval = (key: keyof ConsultationHours) => {
    const current = normalizeDay(value[key]);
    const intervals = dayIntervals(current);
    const next = suggestedNextInterval(intervals);
    if (!next) {
      setDayErrors((currentErrors) => ({
        ...currentErrors,
        [key]: 'No more non-overlapping time slots fit on this day.'
      }));
      return;
    }
    tryUpdateDayIntervals(key, [...intervals, next]);
  };

  const removeInterval = (key: keyof ConsultationHours, index: number) => {
    const current = normalizeDay(value[key]);
    const intervals = dayIntervals(current).filter((_, i) => i !== index);
    if (intervals.length === 0) {
      toggleDay(key, false);
      return;
    }
    tryUpdateDayIntervals(key, intervals);
  };

  const applyMondayHoursTo = (targetKeys: (keyof ConsultationHours)[]) => {
    const template = mondayTemplateFromValue(value);
    if (!template) return;

    const next: ConsultationHours = { ...value };
    const appliedDay = cloneConsultationDay(template);

    for (const key of targetKeys) {
      next[key] = cloneConsultationDay(appliedDay);
    }

    onChange(next);
    setDayErrors({});
  };

  const applyMondayHoursToAllDays = () => applyMondayHoursTo(ALL_DAY_KEYS);
  const mondayHasHours = mondayHasConfiguredHours(value);

  return (
    <div className='consultation-hours-editor'>
      <div className='consultation-hours-editor__head'>
        <div>
          <h4 className='consultation-hours-editor__title'>Weekly availability</h4>
          <p className='consultation-hours-editor__hint'>
            Set when patients can book consultations — similar to a Calendly weekly schedule.
          </p>
        </div>
        <div className='consultation-hours-editor__actions'>
         
          <button
            type='button'
            className='consultation-hours-editor__copy-btn'
            onClick={applyMondayHoursToAllDays}
            disabled={!mondayHasHours}
          >
            <Copy size={14} aria-hidden />
            Apply Hours to all days
          </button>
        </div>
      </div>

      <div className='consultation-hours-editor__panel'>
        {DAYS.map(({ key, label, fullLabel }) => {
          const day = value[key];
          const intervals = dayIntervals(day);
          const dayError = dayErrors[key];

          return (
            <div
              key={key}
              className={joinClasses(
                'consultation-hours-editor__row',
                dayError && 'consultation-hours-editor__row--error'
              )}
            >
              <div className='consultation-hours-editor__toggle'>
                <button
                  type='button'
                  className='consultation-hours-editor__switch'
                  aria-pressed={day.enabled}
                  aria-label={`${day.enabled ? 'Disable' : 'Enable'} ${fullLabel}`}
                  onClick={() => toggleDay(key, !day.enabled)}
                >
                  <span className='consultation-hours-editor__switch-knob' aria-hidden />
                </button>
              </div>

              <div className='consultation-hours-editor__day-label' aria-hidden>
                {label}
              </div>

              {day.enabled ? (
                <div className='consultation-hours-editor__slots'>
                  {intervals.map((interval, index) => (
                    <div key={`${key}-${index}`} className='consultation-hours-editor__slot'>
                      <select
                        className={joinClasses(
                          'consultation-hours-editor__time-select',
                          dayError && 'consultation-hours-editor__time-select--error'
                        )}
                        value={interval.start}
                        aria-label={`${fullLabel} start time ${index + 1}`}
                        onChange={(event) => updateInterval(key, index, { start: event.target.value })}
                      >
                        {TIME_OPTIONS.map((time) => (
                          <option key={`${key}-${index}-start-${time}`} value={time}>
                            {formatTimeLabel(time)}
                          </option>
                        ))}
                      </select>
                      <span className='consultation-hours-editor__time-sep' aria-hidden>
                        —
                      </span>
                      <select
                        className={joinClasses(
                          'consultation-hours-editor__time-select',
                          dayError && 'consultation-hours-editor__time-select--error'
                        )}
                        value={interval.end}
                        aria-label={`${fullLabel} end time ${index + 1}`}
                        onChange={(event) => updateInterval(key, index, { end: event.target.value })}
                      >
                        {TIME_OPTIONS.map((time) => (
                          <option key={`${key}-${index}-end-${time}`} value={time}>
                            {formatTimeLabel(time)}
                          </option>
                        ))}
                      </select>
                      {index === intervals.length - 1 ? (
                        <button
                          type='button'
                          className='consultation-hours-editor__icon-btn'
                          onClick={() => addInterval(key)}
                          aria-label={`Add another time slot on ${fullLabel}`}
                        >
                          <Plus size={16} aria-hidden />
                        </button>
                      ) : null}
                      {intervals.length > 1 ? (
                        <button
                          type='button'
                          className='consultation-hours-editor__icon-btn consultation-hours-editor__icon-btn--danger'
                          onClick={() => removeInterval(key, index)}
                          aria-label={`Remove time slot ${index + 1} on ${fullLabel}`}
                        >
                          <X size={16} aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {dayError ? (
                    <p className='consultation-hours-editor__day-error' role='alert'>
                      {dayError}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className='consultation-hours-editor__unavailable'>Unavailable</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

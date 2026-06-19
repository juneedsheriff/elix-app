import dayjs from 'dayjs';
import { Clock } from 'lucide-react';
import { useMemo } from 'react';
import PatientBirthDatePicker from './PatientBirthDatePicker';
import './patient-appointment-datetime-picker.css';

const TIME_SLOTS = Array.from({ length: 96 }, (_, index) => {
  const hour = Math.floor(index / 4);
  const minute = (index % 4) * 15;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

type PatientAppointmentDateTimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
};

function splitDatetimeLocal(value: string): { date: string; time: string } {
  if (!value.trim()) return { date: '', time: '' };
  const parsed = dayjs(value);
  if (parsed.isValid()) {
    return { date: parsed.format('YYYY-MM-DD'), time: parsed.format('HH:mm') };
  }
  const [date, timePart] = value.split('T');
  return { date: date ?? '', time: (timePart ?? '').slice(0, 5) };
}

function joinDatetimeLocal(date: string, time: string): string {
  if (!date || !time) return '';
  return `${date}T${time}`;
}

function formatTimeLabel(time: string): string {
  return dayjs(`2000-01-01T${time}`).format('h:mm A');
}

function defaultTimeForDate(date: string, slots: string[]): string {
  if (slots.length > 0) return slots[0];
  return dayjs(date).isSame(dayjs(), 'day') ? dayjs().add(1, 'hour').format('HH:00') : '09:00';
}

export default function PatientAppointmentDateTimePicker({
  value,
  onChange,
  disabled = false,
  label = 'Preferred date & time'
}: PatientAppointmentDateTimePickerProps) {
  const { date, time } = splitDatetimeLocal(value);
  const minDate = dayjs().format('YYYY-MM-DD');
  const maxDate = dayjs().add(1, 'year').format('YYYY-MM-DD');

  const availableTimes = useMemo(() => {
    if (!date) return TIME_SLOTS;
    if (!dayjs(date).isSame(dayjs(), 'day')) return TIME_SLOTS;
    const now = dayjs();
    return TIME_SLOTS.filter((slot) => {
      const [hour, minute] = slot.split(':').map(Number);
      return dayjs(date).hour(hour).minute(minute).second(0).isAfter(now);
    });
  }, [date]);

  const handleDateChange = (nextDate: string) => {
    if (!nextDate) {
      onChange('');
      return;
    }

    const slotsForDate =
      dayjs(nextDate).isSame(dayjs(), 'day')
        ? TIME_SLOTS.filter((slot) => {
            const [hour, minute] = slot.split(':').map(Number);
            return dayjs(nextDate).hour(hour).minute(minute).second(0).isAfter(dayjs());
          })
        : TIME_SLOTS;

    let nextTime = time;
    if (!nextTime || !slotsForDate.includes(nextTime)) {
      nextTime = defaultTimeForDate(nextDate, slotsForDate);
    }

    onChange(joinDatetimeLocal(nextDate, nextTime));
  };

  const handleTimeChange = (nextTime: string) => {
    if (!date) return;
    onChange(joinDatetimeLocal(date, nextTime));
  };

  return (
    <div className='patient-appointment-datetime-picker'>
      {label ? <span className='patient-appointment-datetime-picker__label'>{label}</span> : null}
      <div className='patient-appointment-datetime-picker__row'>
        <PatientBirthDatePicker
          label='Date'
          value={date}
          onChange={handleDateChange}
          disabled={disabled}
          minDate={minDate}
          maxDate={maxDate}
          placeholder='Select date'
        />
        <label className='patient-appointment-datetime-picker__time'>
          <span className='patient-birth-date-picker__label'>Time</span>
          <div className='patient-appointment-datetime-picker__time-control'>
            <Clock size={16} aria-hidden className='patient-appointment-datetime-picker__time-icon' />
            <select
              className='patient-appointment-datetime-picker__time-select'
              value={time}
              onChange={(event) => handleTimeChange(event.target.value)}
              disabled={disabled || !date || availableTimes.length === 0}
              aria-label='Preferred appointment time'
            >
              {!date ? <option value=''>Select date first</option> : null}
              {date && availableTimes.length === 0 ? (
                <option value=''>No times left today</option>
              ) : null}
              {availableTimes.map((slot) => (
                <option key={slot} value={slot}>
                  {formatTimeLabel(slot)}
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>
    </div>
  );
}

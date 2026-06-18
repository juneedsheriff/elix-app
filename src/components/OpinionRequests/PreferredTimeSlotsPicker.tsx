import dayjs from 'dayjs';
import { Plus, X } from 'lucide-react';
import PatientBirthDatePicker from '../patient/PatientBirthDatePicker';
import type { PreferredTimeSlot } from '../../types/patientCaseDetails';
import './preferred-time-slots-picker.css';

const TIME_SLOTS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? 0 : 30;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

type PreferredTimeSlotsPickerProps = {
  value: PreferredTimeSlot[];
  onChange: (value: PreferredTimeSlot[]) => void;
  disabled?: boolean;
};

export default function PreferredTimeSlotsPicker({
  value,
  onChange,
  disabled = false
}: PreferredTimeSlotsPickerProps) {
  const addSlot = () => {
    onChange([...value, { date: dayjs().add(1, 'day').format('YYYY-MM-DD'), time: '09:00' }]);
  };

  const updateSlot = (index: number, patch: Partial<PreferredTimeSlot>) => {
    onChange(value.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  };

  const removeSlot = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className='preferred-time-slots'>
      <div className='preferred-time-slots__header'>
        <span className='preferred-time-slots__label'>Preferred time slots</span>
        <button type='button' className='text-btn preferred-time-slots__add' onClick={addSlot} disabled={disabled}>
          <Plus size={16} aria-hidden /> Add slot
        </button>
      </div>
      {value.length === 0 ? (
        <p className='muted preferred-time-slots__empty'>No preferred slots added yet.</p>
      ) : null}
      <ul className='preferred-time-slots__list'>
        {value.map((slot, index) => (
          <li key={`${slot.date}-${slot.time}-${index}`} className='preferred-time-slots__item'>
            <PatientBirthDatePicker
              label='Date'
              value={slot.date}
              onChange={(date) => updateSlot(index, { date })}
              disabled={disabled}
              minDate={dayjs().format('YYYY-MM-DD')}
              maxDate={dayjs().add(1, 'year').format('YYYY-MM-DD')}
              placeholder='Select date'
            />
            <label className='opinion-message-label preferred-time-slots__time-label'>
              Time
              <select
                className='opinion-select'
                value={slot.time}
                onChange={(event) => updateSlot(index, { time: event.target.value })}
                disabled={disabled}
              >
                {TIME_SLOTS.map((time) => (
                  <option key={time} value={time}>
                    {dayjs(`2000-01-01T${time}`).format('h:mm A')}
                  </option>
                ))}
              </select>
            </label>
            <button
              type='button'
              className='preferred-time-slots__remove'
              onClick={() => removeSlot(index)}
              disabled={disabled}
              aria-label='Remove time slot'
            >
              <X size={16} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

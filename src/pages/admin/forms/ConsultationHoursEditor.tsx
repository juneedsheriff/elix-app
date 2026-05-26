import type { ConsultationHours, ConsultationHoursDay } from '../../../types/doctor';

const DAYS: { key: keyof ConsultationHours; label: string }[] = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
];

type ConsultationHoursEditorProps = {
  value: ConsultationHours;
  onChange: (value: ConsultationHours) => void;
};

export default function ConsultationHoursEditor({ value, onChange }: ConsultationHoursEditorProps) {
  const setDay = (key: keyof ConsultationHours, patch: Partial<ConsultationHoursDay>) => {
    onChange({
      ...value,
      [key]: { ...value[key], ...patch }
    });
  };

  return (
    <div className='elixhealth-hours-grid'>
      {DAYS.map(({ key, label }) => {
        const day = value[key];
        return (
          <div key={key} className='elixhealth-hours-row'>
            <label className='elixhealth-hours-day'>
              <input
                type='checkbox'
                checked={day.enabled}
                onChange={(e) => setDay(key, { enabled: e.target.checked })}
              />
              <span>{label}</span>
            </label>
            <label className='elixhealth-field elixhealth-field--inline'>
              <span>From</span>
              <input
                type='time'
                value={day.start}
                disabled={!day.enabled}
                onChange={(e) => setDay(key, { start: e.target.value })}
              />
            </label>
            <label className='elixhealth-field elixhealth-field--inline'>
              <span>To</span>
              <input
                type='time'
                value={day.end}
                disabled={!day.enabled}
                onChange={(e) => setDay(key, { end: e.target.value })}
              />
            </label>
          </div>
        );
      })}
    </div>
  );
}

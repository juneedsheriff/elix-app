import { Group, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useMediaQuery } from '@mantine/hooks';
import { IconCalendar, IconClock } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useMemo, useRef } from 'react';
import './appointment-datetime-picker.css';

type AppointmentDateTimePickerProps = {
  label?: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
  disabled?: boolean;
};

function combineDateAndTime(date: Date, hour: number, minute: number): Date {
  return dayjs(date).hour(hour).minute(minute).second(0).millisecond(0).toDate();
}

function defaultSlotForDate(date: Date): { hour: number; minute: number } {
  const parsed = dayjs(date);
  if (!parsed.isSame(dayjs(), 'day')) {
    return { hour: 9, minute: 0 };
  }
  const soon = dayjs().add(5, 'minute');
  const roundedMinute = Math.ceil(soon.minute() / 5) * 5;
  if (roundedMinute >= 60) {
    return { hour: (soon.hour() + 1) % 24, minute: 0 };
  }
  return { hour: soon.hour(), minute: roundedMinute };
}

export default function AppointmentDateTimePicker({
  label = 'Appointment date & time',
  value,
  onChange,
  disabled
}: AppointmentDateTimePickerProps) {
  const isCompact = useMediaQuery('(max-width: 1024px)');
  const timeInputRef = useRef<HTMLInputElement>(null);
  const todayStart = useMemo(() => dayjs().startOf('day').toDate(), []);
  const dateValue = value ? dayjs(value).startOf('day').toDate() : null;

  const timeString = value ? dayjs(value).format('HH:mm') : '';
  const minTimeString =
    dateValue && dayjs(dateValue).isSame(dayjs(), 'day') ? dayjs().format('HH:mm') : undefined;
  const timeDisabled = Boolean(disabled || !dateValue);

  const excludeDate = (date: Date) => dayjs(date).isBefore(todayStart, 'day');

  const openTimePicker = () => {
    const input = timeInputRef.current;
    if (!input || timeDisabled) return;
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
      }
    } catch {
      // showPicker can throw if not triggered by a user gesture; ignore.
    }
  };

  const handleDateChange = (date: Date | null) => {
    if (!date) {
      onChange(null);
      return;
    }
    const slot = defaultSlotForDate(date);
    let next = combineDateAndTime(date, slot.hour, slot.minute);
    if (dayjs(date).isSame(dayjs(), 'day') && dayjs(next).isBefore(dayjs())) {
      next = dayjs().add(5, 'minute').second(0).millisecond(0).toDate();
    }
    onChange(next);
  };

  const handleTimeChange = (raw: string) => {
    if (!dateValue || !raw) return;
    const [hourRaw, minuteRaw] = raw.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;

    let next = combineDateAndTime(dateValue, hour, minute);
    if (dayjs(dateValue).isSame(dayjs(), 'day') && dayjs(next).isBefore(dayjs())) {
      next = dayjs().add(1, 'minute').second(0).millisecond(0).toDate();
    }
    onChange(next);
  };

  return (
    <Group
      gap='sm'
      align='flex-end'
      wrap='wrap'
      grow={!isCompact}
      className='appointment-datetime-picker'
    >
      <DatePickerInput
        label={label}
        placeholder='Select date'
        value={dateValue}
        onChange={handleDateChange}
        disabled={disabled}
        minDate={todayStart}
        excludeDate={excludeDate}
        clearable
        radius='md'
        size='md'
        valueFormat='MMM D, YYYY'
        dropdownType={isCompact ? 'modal' : 'popover'}
        leftSection={<IconCalendar size={16} stroke={1.75} />}
        popoverProps={{ withinPortal: true, zIndex: 400 }}
        className='appointment-datetime-picker__date'
      />
      <TextInput
        ref={timeInputRef}
        type='time'
        label='Time'
        placeholder='Select time'
        value={timeString}
        min={minTimeString}
        step={300}
        onChange={(event) => handleTimeChange(event.currentTarget.value)}
        onClick={openTimePicker}
        disabled={timeDisabled}
        radius='md'
        size='md'
        leftSection={
          <IconClock
            size={16}
            stroke={1.75}
            style={{ cursor: timeDisabled ? undefined : 'pointer' }}
            onClick={(event) => {
              event.preventDefault();
              openTimePicker();
            }}
          />
        }
        className='appointment-datetime-picker__time'
      />
    </Group>
  );
}

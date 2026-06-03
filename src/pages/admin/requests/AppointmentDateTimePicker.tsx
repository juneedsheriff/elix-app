import { Group } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import AnalogTimePicker from '../../../components/common/AnalogTimePicker';
import { IconCalendar } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useMemo } from 'react';

type AppointmentDateTimePickerProps = {
  label?: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
  disabled?: boolean;
};

const MINUTE_SLOTS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] as const;

function combineDateAndTime(date: Date, hour: number, minute: number): Date {
  return dayjs(date).hour(hour).minute(minute).second(0).millisecond(0).toDate();
}

function allowedMinutesForHour(
  hour: number,
  date: Date,
  minTime: dayjs.Dayjs | undefined
): number[] {
  return MINUTE_SLOTS.filter((minute) => {
    const slot = dayjs(date).hour(hour).minute(minute).second(0);
    if (!minTime) return true;
    return slot.isAfter(minTime);
  });
}

function allowedHoursForDate(date: Date, minTime: dayjs.Dayjs | undefined): number[] {
  return Array.from({ length: 24 }, (_, hour) => hour).filter(
    (hour) => allowedMinutesForHour(hour, date, minTime).length > 0
  );
}

function defaultSlotForDate(date: Date): { hour: number; minute: number } {
  const minTime = dayjs(date).isSame(dayjs(), 'day') ? dayjs() : undefined;
  const hours = allowedHoursForDate(date, minTime);
  const hour = hours[0] ?? 9;
  const minutes = allowedMinutesForHour(hour, date, minTime);
  return { hour, minute: minutes[0] ?? 0 };
}

export default function AppointmentDateTimePicker({
  label = 'Appointment date & time',
  value,
  onChange,
  disabled
}: AppointmentDateTimePickerProps) {
  const todayStart = useMemo(() => dayjs().startOf('day').toDate(), []);
  const dateValue = value ? dayjs(value).startOf('day').toDate() : null;

  const minDateTime = useMemo(() => {
    if (!dateValue || !dayjs(dateValue).isSame(dayjs(), 'day')) return undefined;
    return dayjs();
  }, [dateValue]);

  const timeValue = useMemo(() => {
    if (value == null) return null;
    return { hour: dayjs(value).hour(), minute: dayjs(value).minute() };
  }, [value]);

  const excludeDate = (date: Date) => dayjs(date).isBefore(todayStart, 'day');

  const handleDateChange = (date: Date | null) => {
    if (!date) {
      onChange(null);
      return;
    }
    const slot = defaultSlotForDate(date);
    onChange(combineDateAndTime(date, slot.hour, slot.minute));
  };

  const handleTimeChange = (next: { hour: number; minute: number }) => {
    if (!dateValue) return;
    onChange(combineDateAndTime(dateValue, next.hour, next.minute));
  };

  return (
    <Group gap='sm' align='flex-end' wrap='wrap' grow>
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
        leftSection={<IconCalendar size={16} stroke={1.75} />}
        popoverProps={{ withinPortal: true, zIndex: 400 }}
        style={{ flex: 1.4, minWidth: '12rem' }}
      />
      <AnalogTimePicker
        label='Time'
        value={timeValue}
        onChange={handleTimeChange}
        disabled={disabled || !dateValue}
        minDateTime={minDateTime}
        placeholder='Select time'
        zIndex={401}
      />
    </Group>
  );
}

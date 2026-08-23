import { Group, Select, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useMediaQuery } from '@mantine/hooks';
import { IconCalendar, IconClock } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import {
  formatConsultationTimeSlotLabel,
  getAvailableConsultationTimeSlots,
  hasConfiguredConsultationHours,
  isConsultationDateAvailable
} from '../../../lib/doctorSchedule';
import type { ConsultationHours } from '../../../types/doctor';
import './appointment-datetime-picker.css';

type AppointmentDateTimePickerProps = {
  label?: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
  disabled?: boolean;
  /** Doctor weekly availability — unavailable weekdays are blocked on the calendar. */
  consultationHours?: ConsultationHours | null;
  /** Slot step in minutes (from doctor scheduler settings). Defaults to 30. */
  intervalMinutes?: number | null;
};

function combineDateAndTime(date: Date, time: string): Date {
  const [hourRaw, minuteRaw] = time.split(':');
  return dayjs(date)
    .hour(Number(hourRaw) || 0)
    .minute(Number(minuteRaw) || 0)
    .second(0)
    .millisecond(0)
    .toDate();
}

export default function AppointmentDateTimePicker({
  label = 'Appointment date & time',
  value,
  onChange,
  disabled,
  consultationHours = null,
  intervalMinutes = 30
}: AppointmentDateTimePickerProps) {
  const isCompact = useMediaQuery('(max-width: 1024px)');
  const todayStart = useMemo(() => dayjs().startOf('day').toDate(), []);
  const dateValue = value ? dayjs(value).startOf('day').toDate() : null;
  const hoursConfigured = hasConfiguredConsultationHours(consultationHours);

  const availableTimes = useMemo(() => {
    if (!dateValue) return [];
    const after = dayjs(dateValue).isSame(dayjs(), 'day') ? new Date() : null;
    return getAvailableConsultationTimeSlots(consultationHours, dateValue, {
      intervalMinutes,
      after
    });
  }, [consultationHours, dateValue, intervalMinutes]);

  const timeString = value ? dayjs(value).format('HH:mm') : '';
  const selectedTime = availableTimes.includes(timeString) ? timeString : null;
  const timeDisabled = Boolean(disabled || !dateValue || availableTimes.length === 0);

  const timeOptions = useMemo(
    () =>
      availableTimes.map((slot) => ({
        value: slot,
        label: formatConsultationTimeSlotLabel(slot)
      })),
    [availableTimes]
  );

  const excludeDate = (date: Date) => {
    if (dayjs(date).isBefore(todayStart, 'day')) return true;
    if (!hoursConfigured) return false;
    if (!isConsultationDateAvailable(consultationHours, date)) return true;
    const after = dayjs(date).isSame(dayjs(), 'day') ? new Date() : null;
    return (
      getAvailableConsultationTimeSlots(consultationHours, date, {
        intervalMinutes,
        after
      }).length === 0
    );
  };

  const handleDateChange = (date: Date | null) => {
    if (!date) {
      onChange(null);
      return;
    }

    const after = dayjs(date).isSame(dayjs(), 'day') ? new Date() : null;
    const slots = getAvailableConsultationTimeSlots(consultationHours, date, {
      intervalMinutes,
      after
    });

    if (slots.length === 0) {
      onChange(null);
      return;
    }

    const currentTime = value ? dayjs(value).format('HH:mm') : '';
    const nextTime = slots.includes(currentTime) ? currentTime : slots[0];
    onChange(combineDateAndTime(date, nextTime));
  };

  const handleTimeChange = (raw: string | null) => {
    if (!dateValue || !raw) return;
    onChange(combineDateAndTime(dateValue, raw));
  };

  return (
    <div className='appointment-datetime-picker-wrap'>
      <Group
        gap='sm'
        align='flex-end'
        wrap='wrap'
        grow={!isCompact}
        className='appointment-datetime-picker'
      >
        <DatePickerInput
          label={label}
          placeholder='Select available date'
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
        <Select
          label='Time'
          placeholder={
            !dateValue
              ? 'Select date first'
              : availableTimes.length === 0
                ? 'No times available'
                : 'Select time'
          }
          data={timeOptions}
          value={selectedTime}
          onChange={handleTimeChange}
          disabled={timeDisabled}
          searchable
          radius='md'
          size='md'
          leftSection={<IconClock size={16} stroke={1.75} />}
          nothingFoundMessage='No available times'
          className='appointment-datetime-picker__time'
          comboboxProps={{ withinPortal: true, zIndex: 400 }}
        />
      </Group>
      {hoursConfigured ? (
        <Text size='xs' c='dimmed' mt={6} className='appointment-datetime-picker__hint'>
          Only dates and times from this doctor&apos;s weekly availability are shown.
        </Text>
      ) : (
        <Text size='xs' c='dimmed' mt={6} className='appointment-datetime-picker__hint'>
          This doctor has no weekly availability set — any upcoming date and time can be chosen.
        </Text>
      )}
    </div>
  );
}

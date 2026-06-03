import { Input, Popover, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconClock, IconKeyboard } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useCallback, useEffect, useId, useState } from 'react';
import './analog-time-picker.css';

export type AnalogTimeValue = {
  hour: number;
  minute: number;
};

type AnalogTimePickerProps = {
  label?: string;
  value: AnalogTimeValue | null;
  onChange: (value: AnalogTimeValue) => void;
  disabled?: boolean;
  minDateTime?: dayjs.Dayjs;
  placeholder?: string;
  zIndex?: number;
};

type PickerMode = 'hour' | 'minute';
type Period = 'AM' | 'PM';

const HOUR_MARKERS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
const MINUTE_MARKERS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] as const;

const DIAL_SIZE = 256;
const DIAL_CENTER = DIAL_SIZE / 2;
const DIAL_RADIUS = 98;
const MARKER_HIT_RADIUS = 18;

type DraftState = {
  hour12: number;
  minute: number;
  period: Period;
};

function to24Hour(hour12: number, period: Period): number {
  if (period === 'AM') return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

function to12Hour(hour24: number): { hour12: number; period: Period } {
  return {
    hour12: hour24 % 12 || 12,
    period: hour24 >= 12 ? 'PM' : 'AM'
  };
}

function snapMinute(minute: number): number {
  return Math.min(55, Math.round(minute / 5) * 5);
}

/** Clock position in degrees (0 = 12 o'clock, clockwise). */
function hourToDegrees(hour12: number): number {
  return (hour12 % 12) * 30;
}

function minuteToDegrees(minute: number): number {
  return (minute / 5) * 30;
}

function polarToCartesian(degrees: number, radius: number) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return {
    x: DIAL_CENTER + Math.cos(radians) * radius,
    y: DIAL_CENTER + Math.sin(radians) * radius
  };
}

function formatDisplayTime(hour: number, minute: number): string {
  return dayjs().hour(hour).minute(minute).format('h:mm A');
}

function isSlotAllowed(
  hour24: number,
  minute: number,
  minDateTime: dayjs.Dayjs | undefined
): boolean {
  if (!minDateTime) return true;
  const slot = minDateTime.startOf('day').hour(hour24).minute(minute).second(0).millisecond(0);
  return slot.isAfter(minDateTime);
}

function draftFromValue(value: AnalogTimeValue | null): DraftState {
  if (!value) {
    return { hour12: 9, minute: 0, period: 'AM' };
  }
  const { hour12, period } = to12Hour(value.hour);
  return { hour12, minute: snapMinute(value.minute), period };
}

type ClockDialProps = {
  mode: PickerMode;
  draft: DraftState;
  handDegrees: number;
  isHourAllowed: (hour12: number) => boolean;
  isMinuteAllowed: (minute: number) => boolean;
  onSelectHour: (hour12: number) => void;
  onSelectMinute: (minute: number) => void;
};

function ClockDial({
  mode,
  draft,
  handDegrees,
  isHourAllowed,
  isMinuteAllowed,
  onSelectHour,
  onSelectMinute
}: ClockDialProps) {
  const labelId = useId();
  const handEnd = polarToCartesian(handDegrees, DIAL_RADIUS - 26);

  const markers =
    mode === 'hour'
      ? HOUR_MARKERS.map((hour12) => ({
          key: `h-${hour12}`,
          label: String(hour12),
          degrees: hourToDegrees(hour12),
          selected: draft.hour12 === hour12,
          disabled: !isHourAllowed(hour12),
          onSelect: () => onSelectHour(hour12)
        }))
      : MINUTE_MARKERS.map((minute) => ({
          key: `m-${minute}`,
          label: String(minute).padStart(2, '0'),
          degrees: minuteToDegrees(minute),
          selected: draft.minute === minute,
          disabled: !isMinuteAllowed(minute),
          onSelect: () => onSelectMinute(minute)
        }));

  return (
    <svg
      className='analog-time-picker__svg'
      viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}
      role='group'
      aria-labelledby={labelId}
    >
      <title id={labelId}>{mode === 'hour' ? 'Select hour' : 'Select minute'}</title>
      <circle
        className='analog-time-picker__dial-bg'
        cx={DIAL_CENTER}
        cy={DIAL_CENTER}
        r={DIAL_RADIUS}
      />
      <line
        className='analog-time-picker__hand-line'
        x1={DIAL_CENTER}
        y1={DIAL_CENTER}
        x2={handEnd.x}
        y2={handEnd.y}
      />
      <circle
        className='analog-time-picker__hand-dot'
        cx={DIAL_CENTER}
        cy={DIAL_CENTER}
        r={4}
      />
      {markers.map((marker) => {
        const { x, y } = polarToCartesian(marker.degrees, DIAL_RADIUS);
        return (
          <g key={marker.key} className='analog-time-picker__marker-group'>
            {marker.selected ? (
              <circle
                className='analog-time-picker__marker-selected'
                cx={x}
                cy={y}
                r={MARKER_HIT_RADIUS}
              />
            ) : null}
            <circle
              className={`analog-time-picker__marker-hit${marker.disabled ? ' analog-time-picker__marker-hit--disabled' : ''}`}
              cx={x}
              cy={y}
              r={MARKER_HIT_RADIUS}
              onClick={marker.disabled ? undefined : marker.onSelect}
            />
            <text
              className={`analog-time-picker__marker-label${marker.selected ? ' analog-time-picker__marker-label--selected' : ''}${marker.disabled ? ' analog-time-picker__marker-label--disabled' : ''}`}
              x={x}
              y={y}
              textAnchor='middle'
              dominantBaseline='central'
              onClick={marker.disabled ? undefined : marker.onSelect}
            >
              {marker.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function AnalogTimePicker({
  label = 'Time',
  value,
  onChange,
  disabled,
  minDateTime,
  placeholder = 'Select time',
  zIndex = 401
}: AnalogTimePickerProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const [mode, setMode] = useState<PickerMode>('hour');
  const [draft, setDraft] = useState<DraftState>(() => draftFromValue(value));
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [keyboardValue, setKeyboardValue] = useState('');

  const resetDraft = useCallback(() => {
    setDraft(draftFromValue(value));
    setMode('hour');
    setKeyboardMode(false);
    setKeyboardValue(value ? dayjs().hour(value.hour).minute(value.minute).format('HH:mm') : '');
  }, [value]);

  useEffect(() => {
    if (opened) resetDraft();
  }, [opened, resetDraft]);

  const displayText = value ? formatDisplayTime(value.hour, value.minute) : '';
  const hour24Draft = to24Hour(draft.hour12, draft.period);

  const isHourAllowed = (hour12: number) => {
    const hour24 = to24Hour(hour12, draft.period);
    return MINUTE_MARKERS.some((minute) => isSlotAllowed(hour24, minute, minDateTime));
  };

  const isMinuteAllowed = (minute: number) => isSlotAllowed(hour24Draft, minute, minDateTime);

  const handDegrees =
    mode === 'hour' ? hourToDegrees(draft.hour12) : minuteToDegrees(draft.minute);

  const applyDraft = () => {
    const hour = to24Hour(draft.hour12, draft.period);
    const minute = snapMinute(draft.minute);
    if (!isSlotAllowed(hour, minute, minDateTime)) return false;
    onChange({ hour, minute });
    return true;
  };

  const handleOk = () => {
    if (applyDraft()) close();
  };

  const handleCancel = () => {
    resetDraft();
    close();
  };

  const handleKeyboardOk = () => {
    const parsed = dayjs(`1970-01-01T${keyboardValue}`, 'YYYY-MM-DDTHH:mm', true);
    if (!parsed.isValid()) return;
    const hour = parsed.hour();
    const minute = snapMinute(parsed.minute());
    if (!isSlotAllowed(hour, minute, minDateTime)) return;
    onChange({ hour, minute });
    close();
  };

  const popoverContent = keyboardMode ? (
    <div className='analog-time-picker'>
      <div className='analog-time-picker__header'>
        <p className='analog-time-picker__label'>Enter time</p>
      </div>
      <div className='analog-time-picker__keyboard-input'>
        <TextInput
          type='time'
          value={keyboardValue}
          onChange={(event) => setKeyboardValue(event.currentTarget.value)}
          radius='md'
          size='md'
        />
      </div>
      <div className='analog-time-picker__footer'>
        <button
          type='button'
          className='analog-time-picker__keyboard'
          aria-label='Use clock'
          onClick={() => setKeyboardMode(false)}
        >
          <IconClock size={18} stroke={1.75} />
        </button>
        <div className='analog-time-picker__actions'>
          <button type='button' className='analog-time-picker__action' onClick={handleCancel}>
            CANCEL
          </button>
          <button type='button' className='analog-time-picker__action' onClick={handleKeyboardOk}>
            OK
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div className='analog-time-picker'>
      <div className='analog-time-picker__header'>
        <p className='analog-time-picker__label'>Select time</p>
        <div className='analog-time-picker__digital'>
          <div className='analog-time-picker__digital-main'>
            <button
              type='button'
              className={`analog-time-picker__digit ${mode === 'hour' ? 'analog-time-picker__digit--active' : ''}`}
              onClick={() => setMode('hour')}
            >
              {String(draft.hour12)}
            </button>
            <span className='analog-time-picker__colon'>:</span>
            <button
              type='button'
              className={`analog-time-picker__digit ${mode === 'minute' ? 'analog-time-picker__digit--active' : ''}`}
              onClick={() => setMode('minute')}
            >
              {String(draft.minute).padStart(2, '0')}
            </button>
          </div>
          <div className='analog-time-picker__period'>
            {(['AM', 'PM'] as const).map((period) => (
              <button
                key={period}
                type='button'
                className={`analog-time-picker__period-btn ${draft.period === period ? 'analog-time-picker__period-btn--active' : ''}`}
                onClick={() => setDraft((prev) => ({ ...prev, period }))}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className='analog-time-picker__dial-wrap'>
        <ClockDial
          mode={mode}
          draft={draft}
          handDegrees={handDegrees}
          isHourAllowed={isHourAllowed}
          isMinuteAllowed={isMinuteAllowed}
          onSelectHour={(hour12) => {
            setDraft((prev) => ({ ...prev, hour12 }));
            setMode('minute');
          }}
          onSelectMinute={(minute) => setDraft((prev) => ({ ...prev, minute }))}
        />
      </div>

      <div className='analog-time-picker__footer'>
        <button
          type='button'
          className='analog-time-picker__keyboard'
          aria-label='Enter time with keyboard'
          onClick={() => {
            setKeyboardValue(dayjs().hour(hour24Draft).minute(draft.minute).format('HH:mm'));
            setKeyboardMode(true);
          }}
        >
          <IconKeyboard size={18} stroke={1.75} />
        </button>
        <div className='analog-time-picker__actions'>
          <button type='button' className='analog-time-picker__action' onClick={handleCancel}>
            CANCEL
          </button>
          <button type='button' className='analog-time-picker__action' onClick={handleOk}>
            OK
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <Popover
      opened={opened}
      onChange={(next) => (next ? open() : handleCancel())}
      position='bottom-start'
      withinPortal
      zIndex={zIndex}
      trapFocus
      shadow='md'
    >
      <Popover.Target>
        <Input
          label={label}
          placeholder={placeholder}
          value={displayText}
          readOnly
          disabled={disabled}
          radius='md'
          size='md'
          leftSection={<IconClock size={16} stroke={1.75} />}
          onClick={() => {
            if (!disabled) open();
          }}
          onKeyDown={(event) => {
            if (disabled) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              open();
            }
          }}
          style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
          styles={{ input: { cursor: disabled ? 'not-allowed' : 'pointer' } }}
        />
      </Popover.Target>
      <Popover.Dropdown p={0}>{popoverContent}</Popover.Dropdown>
    </Popover>
  );
}

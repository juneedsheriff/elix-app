import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Group,
  Paper,
  Radio,
  Stack,
  Text,
  Textarea,
  TextInput
} from '@mantine/core';
import { toDatetimeLocalInputValue } from '../../../lib/doctorSchedule';
import {
  pseProposeConfirmedSchedule,
  pseProposeScheduleAlternatives
} from '../../../lib/opinionRequests';
import type { OpinionRequest } from '../../../types/opinionRequest';

type PatientSelectionReviewProps = {
  request: OpinionRequest;
  canCoordinate: boolean;
  onUpdated: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

type AvailabilityVerdict = 'available' | 'unavailable' | '';

function patientPreferredAtLocal(request: OpinionRequest): string {
  const raw = request.patient_availability;
  if (!raw || typeof raw !== 'object') return '';
  const preferred = (raw as { preferred_at?: string }).preferred_at;
  if (typeof preferred !== 'string' || !preferred.trim()) return '';
  return toDatetimeLocalInputValue(preferred);
}

export default function PatientSelectionReview({
  request,
  canCoordinate,
  onUpdated,
  onError,
  onSuccess
}: PatientSelectionReviewProps) {
  const [verdict, setVerdict] = useState<AvailabilityVerdict>('');
  const [confirmedAt, setConfirmedAt] = useState('');
  const [pseMessage, setPseMessage] = useState('');
  const [alternativeSlots, setAlternativeSlots] = useState('');
  const [busy, setBusy] = useState(false);

  const stage = request.consultation_stage;

  useEffect(() => {
    const fromPatient = patientPreferredAtLocal(request);
    if (fromPatient) {
      setConfirmedAt(fromPatient);
      return;
    }
    if (request.scheduled_at) {
      setConfirmedAt(toDatetimeLocalInputValue(request.scheduled_at));
    }
  }, [request.id, request.patient_availability, request.scheduled_at]);

  const showReview =
    stage === 'doctor_selected' ||
    stage === 'availability_submitted' ||
    stage === 'schedule_proposed' ||
    stage === 'schedule_confirmed';

  if (!showReview) return null;

  const handleProposeConfirmed = async () => {
    if (!confirmedAt) {
      onError('Select the confirmed appointment date and time.');
      return;
    }
    setBusy(true);
    const { error } = await pseProposeConfirmedSchedule(request.id, {
      scheduledAt: new Date(confirmedAt).toISOString(),
      message: pseMessage
    });
    setBusy(false);
    if (error) {
      onError(error.message);
      return;
    }
    onSuccess('Schedule sent to the patient for confirmation.');
    onUpdated();
  };

  const handleProposeAlternatives = async () => {
    setBusy(true);
    const { error } = await pseProposeScheduleAlternatives(request.id, {
      alternativeSlots,
      message: pseMessage
    });
    setBusy(false);
    if (error) {
      onError(error.message);
      return;
    }
    onSuccess('Alternative slots sent to the patient for confirmation.');
    onUpdated();
  };

  const needsAvailabilityReview = stage === 'availability_submitted';
  const awaitingPatientConfirm = stage === 'schedule_proposed';
  const scheduleConfirmed = stage === 'schedule_confirmed' || Boolean(request.schedule_confirmed_at);

  if (scheduleConfirmed && !needsAvailabilityReview && !awaitingPatientConfirm) {
    return null;
  }

  return (
    <Paper radius='md' p='md' withBorder className='doctors-mgmt-patient-selection'>
      <Group justify='space-between' align='flex-start' wrap='wrap' gap='sm' mb='sm'>
        <Stack gap={4}>
          <Text size='sm' fw={700}>
            Patient doctor &amp; preferred time
          </Text>
        </Stack>
        {needsAvailabilityReview ? (
          <Badge variant='light' color='cyan' radius='xl'>
            Review availability
          </Badge>
        ) : null}
        {awaitingPatientConfirm ? (
          <Badge variant='light' color='orange' radius='xl'>
            Awaiting patient confirmation
          </Badge>
        ) : null}
        {scheduleConfirmed ? (
          <Badge variant='light' color='green' radius='xl'>
            Schedule confirmed
          </Badge>
        ) : null}
      </Group>

      {canCoordinate && needsAvailabilityReview ? (
        <Stack gap='md'>
          <Radio.Group
            label='Is this doctor available at the patient&apos;s preferred time?'
            value={verdict}
            onChange={(v) => setVerdict((v as AvailabilityVerdict) || '')}
          >
            <Group gap='lg' mt='xs'>
              <Radio value='available' label='Yes, available' />
              <Radio value='unavailable' label='No, not available' />
            </Group>
          </Radio.Group>

          {verdict === 'available' ? (
            <Stack gap='sm'>
              <TextInput
                label='Confirmed appointment time'
                type='datetime-local'
                value={confirmedAt}
                onChange={(e) => setConfirmedAt(e.currentTarget.value)}
              />
              <Textarea
                label='Note to patient (optional)'
                minRows={2}
                value={pseMessage}
                onChange={(e) => setPseMessage(e.currentTarget.value)}
              />
              <Button
                className='doctors-mgmt-header__primary'
                radius='md'
                loading={busy}
                onClick={() => void handleProposeConfirmed()}
              >
                Send confirmed time to patient
              </Button>
            </Stack>
          ) : null}

          {verdict === 'unavailable' ? (
            <Stack gap='sm'>
              <Textarea
                label='Alternative slots for the patient'
                placeholder='List times when the doctor is available'
                minRows={3}
                value={alternativeSlots}
                onChange={(e) => setAlternativeSlots(e.currentTarget.value)}
              />
              <Textarea
                label='Note to patient (optional)'
                minRows={2}
                value={pseMessage}
                onChange={(e) => setPseMessage(e.currentTarget.value)}
              />
              <Button
                variant='light'
                color='cyan'
                radius='md'
                loading={busy}
                onClick={() => void handleProposeAlternatives()}
              >
                Send alternatives to patient
              </Button>
            </Stack>
          ) : null}
        </Stack>
      ) : null}

      {awaitingPatientConfirm ? (
        <Text size='sm' c='dimmed'>
          Waiting for the patient to confirm. You can send the payment link from Step 4 after they
          confirm.
        </Text>
      ) : null}

    </Paper>
  );
}

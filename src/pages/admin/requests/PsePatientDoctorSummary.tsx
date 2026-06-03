import { useState } from 'react';
import { Badge, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { IconCalendar, IconCheck, IconStethoscope, IconUsers } from '@tabler/icons-react';
import { canPseApprovePatientSelection, isScheduleConfirmed } from '../../../lib/consultationWizard';
import { formatPatientAvailability } from '../../../lib/doctorSchedule';
import { pseApprovePatientSelection } from '../../../lib/opinionRequests';
import type { OpinionRequest, OpinionRequestRecommendation } from '../../../types/opinionRequest';

type PsePatientDoctorSummaryProps = {
  request: OpinionRequest;
  recommendations: OpinionRequestRecommendation[];
  canCoordinate?: boolean;
  onUpdated?: () => void;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
  onApproved?: () => void;
};

export default function PsePatientDoctorSummary({
  request,
  recommendations,
  canCoordinate = false,
  onUpdated,
  onError,
  onSuccess,
  onApproved
}: PsePatientDoctorSummaryProps) {
  const [busy, setBusy] = useState(false);
  const patientAvailability = formatPatientAvailability(request.patient_availability);
  const hasPatientDoctor = Boolean(request.doctor_name || request.selected_doctor_id);
  const scheduleConfirmed = isScheduleConfirmed(request);
  const showApprove = canCoordinate && canPseApprovePatientSelection(request);

  const handleApprove = async () => {
    setBusy(true);
    const { error } = await pseApprovePatientSelection(request.id);
    setBusy(false);
    if (error) {
      onError?.(error.message);
      return;
    }
    onSuccess?.('Patient selection approved. Continue to Step 4 — Send payment link.');
    onUpdated?.();
    onApproved?.();
  };

  return (
    <div className='pse-doctors-overview'>
      <Paper radius='md' p='md' withBorder className='pse-doctors-overview__card'>
        <Group gap='xs' mb='sm'>
          <IconUsers size={18} aria-hidden />
          <Text size='sm' fw={700}>
            Doctors recommended by PSE
          </Text>
        </Group>
        {recommendations.length > 0 ? (
          <Stack gap='xs'>
            {recommendations.map((rec, index) => (
              <Text key={rec.id} size='sm'>
                <Text span fw={600} component='span'>
                  {index + 1}.{' '}
                </Text>
                {rec.doctor_name ?? 'Doctor'}
                {rec.doctor_specialty ? ` · ${rec.doctor_specialty}` : ''}
              </Text>
            ))}
          </Stack>
        ) : (
          <Text size='sm' c='dimmed'>
            No doctors on the recommendation list yet. Add doctors below and share with the patient.
          </Text>
        )}
      </Paper>

      <Paper radius='md' p='md' withBorder className='pse-doctors-overview__card'>
        <Group justify='space-between' align='flex-start' wrap='wrap' gap='sm' mb='sm'>
          <Group gap='xs'>
            <IconStethoscope size={18} aria-hidden />
            <Text size='sm' fw={700}>
              Patient selection
            </Text>
          </Group>
          {scheduleConfirmed ? (
            <Badge variant='light' color='green' radius='xl'>
              Approved
            </Badge>
          ) : hasPatientDoctor ? (
            <Badge variant='light' color='cyan' radius='xl'>
              Awaiting confirmation
            </Badge>
          ) : (
            <Badge variant='light' color='gray' radius='xl'>
              Not selected yet
            </Badge>
          )}
        </Group>

        {hasPatientDoctor ? (
          <Stack gap='md'>
            <Stack gap={4}>
              <Text size='xs' fw={600} c='dimmed' tt='uppercase'>
                Selected doctor
              </Text>
              <Text size='sm' fw={700}>
                {request.doctor_name ?? 'Doctor'}
                {request.doctor_specialty ? ` · ${request.doctor_specialty}` : ''}
              </Text>
            </Stack>

            {patientAvailability ? (
              <Group gap='xs' wrap='nowrap' align='flex-start'>
                <IconCalendar size={18} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
                <Stack gap={4}>
                  <Text size='xs' fw={600} c='dimmed' tt='uppercase'>
                    Preferred date &amp; time
                  </Text>
                  <Text size='sm' fw={600} style={{ whiteSpace: 'pre-wrap' }}>
                    {patientAvailability}
                  </Text>
                </Stack>
              </Group>
            ) : (
              <Text size='sm' c='dimmed'>
                Patient has not submitted a preferred appointment time yet.
              </Text>
            )}

            {request.schedule_confirmed_at ? (
              <Text size='xs' c='dimmed'>
                Approved {new Date(request.schedule_confirmed_at).toLocaleString()}
              </Text>
            ) : null}

            {scheduleConfirmed ? (
              <Text size='sm' c='green' mt={4}>
                Patient selection approved. Continue to Step 4 — Send payment link.
              </Text>
            ) : null}

            {request.scheduled_at && request.consultation_stage === 'schedule_proposed' ? (
              <Stack gap={4}>
                <Text size='xs' fw={600} c='dimmed' tt='uppercase'>
                  Proposed slot
                </Text>
                <Text size='sm'>{new Date(request.scheduled_at).toLocaleString()}</Text>
              </Stack>
            ) : null}

            {showApprove ? (
              <Button
                className='doctors-mgmt-header__primary'
                radius='md'
                leftSection={<IconCheck size={16} />}
                loading={busy}
                onClick={() => void handleApprove()}
              >
                Approve
              </Button>
            ) : null}
          </Stack>
        ) : (
          <Text size='sm' c='dimmed'>
            The patient has not chosen a doctor yet. Share your recommendations so they can select one
            and submit their preferred time.
          </Text>
        )}
      </Paper>
    </div>
  );
}

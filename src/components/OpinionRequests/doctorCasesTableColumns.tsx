import { useMemo } from 'react';
import { Anchor, Avatar, Badge, Button, Group, Stack, Text, Tooltip } from '@mantine/core';
import { IconCalendar, IconFileDescription, IconFileText, IconVideo } from '@tabler/icons-react';
import type { MRT_ColumnDef } from 'mantine-react-table';
import {
  canDoctorGiveConsultation,
  consultationNotesPreview,
  hasPatientConsultationNotes
} from '../../lib/doctorConsultation';
import { formatConsultationFollowupDate } from '../../lib/consultationSummaryFields';
import type { OpinionRequest } from '../../types/opinionRequest';
import { formatRequestDate, patientInitials } from '../../pages/admin/requests/requestsUtils';
import DoctorGiveConsultationButton from './DoctorGiveConsultationButton';

type UseDoctorCasesTableColumnsOptions = {
  onNavigate?: (screenId: string) => void;
  returnScreen?: string;
  onViewCaseDetails: (request: OpinionRequest) => void;
  onViewConsultationNotes: (request: OpinionRequest) => void;
};

function displayCell(value: string | null | undefined) {
  const v = value?.trim();
  return v ? v : '—';
}

function doctorStatusLabel(status: string): string {
  if (status === 'in_review') return 'In review';
  if (status === 'closed') return 'Completed';
  return 'Submitted';
}

function doctorStatusColor(status: string): 'yellow' | 'green' | 'cyan' {
  if (status === 'in_review') return 'yellow';
  if (status === 'closed') return 'green';
  return 'cyan';
}

function truncateMessage(message: string, maxLength = 72): string {
  const trimmed = message.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

function patientFollowupDate(request: OpinionRequest): string {
  const fromSummary = formatConsultationFollowupDate(request.consultation_summary?.followup_date);
  if (fromSummary) return fromSummary;
  return formatConsultationFollowupDate(request.home_care_followup_date) || '—';
}

export function useDoctorCasesTableColumns({
  onNavigate,
  returnScreen = 'doctor-dashboard',
  onViewCaseDetails,
  onViewConsultationNotes
}: UseDoctorCasesTableColumnsOptions) {
  return useMemo<MRT_ColumnDef<OpinionRequest>[]>(
    () => [
      {
        accessorKey: 'patient_name',
        header: 'Patient',
        size: 260,
        minSize: 220,
        Cell: ({ row }) => {
          const request = row.original;
          return (
            <Group gap='sm' wrap='nowrap' className='doctors-mgmt-doctor-cell'>
              <Avatar
                radius='xl'
                size={40}
                variant='filled'
                className='doctors-mgmt-avatar'
                styles={{
                  root: { flexShrink: 0 },
                  placeholder: { color: '#fff', fontWeight: 700, fontSize: '0.8rem' }
                }}
              >
                {patientInitials(request.patient_name)}
              </Avatar>
              <Stack gap={2} className='doctors-mgmt-doctor-cell__text'>
                <Text fw={700} size='sm'>
                  {displayCell(request.patient_name)}
                </Text>
                {request.patient_email ? (
                  <Text size='xs' c='dimmed' className='doctors-mgmt-muted'>
                    {request.patient_email}
                  </Text>
                ) : null}
              </Stack>
            </Group>
          );
        }
      },
      {
        accessorKey: 'created_at',
        header: 'Submitted',
        size: 130,
        minSize: 110,
        Cell: ({ cell }) => (
          <Text size='sm' className='doctors-mgmt-muted'>
            {formatRequestDate(cell.getValue<string>())}
          </Text>
        )
      },
      {
        accessorKey: 'message',
        header: 'Message',
        size: 200,
        minSize: 150,
        Cell: ({ row }) => (
          <Tooltip label={row.original.message} multiline maw={320} withArrow>
            <Text size='sm' lineClamp={2} className='doctors-mgmt-muted'>
              {truncateMessage(row.original.message)}
            </Text>
          </Tooltip>
        )
      },
      {
        id: 'consultation',
        header: 'Consultation',
        accessorFn: (row) => row.scheduled_at ?? row.meeting_link ?? '',
        size: 180,
        minSize: 150,
        Cell: ({ row }) => {
          const request = row.original;
          const meetingLink = request.meeting_link?.trim();
          const scheduledAt = request.scheduled_at?.trim();

          if (!meetingLink && !scheduledAt) {
            return (
              <Text size='sm' className='doctors-mgmt-muted'>
                —
              </Text>
            );
          }

          return (
            <Stack gap={4}>
              {meetingLink ? (
                <Group gap={6} wrap='nowrap'>
                  <IconVideo size={15} stroke={1.6} />
                  <Text size='sm' fw={600}>
                    Video
                  </Text>
                </Group>
              ) : (
                <Group gap={6} wrap='nowrap'>
                  <IconCalendar size={15} stroke={1.6} />
                  <Text size='sm' fw={600}>
                    Scheduled
                  </Text>
                </Group>
              )}
              {scheduledAt ? (
                <Group gap={6} wrap='nowrap'>
                  <IconCalendar size={14} stroke={1.6} />
                  <Text size='xs' c='dimmed' className='doctors-mgmt-muted'>
                    {new Date(scheduledAt).toLocaleString()}
                  </Text>
                </Group>
              ) : null}
              {meetingLink ? (
                <Anchor href={meetingLink} target='_blank' rel='noreferrer' size='xs' fw={600}>
                  Join meeting
                </Anchor>
              ) : null}
            </Stack>
          );
        }
      },
      {
        id: 'patient_followup_date',
        header: 'Patient Follow-up Date',
        accessorFn: (row) =>
          row.consultation_summary?.followup_date?.trim() ||
          row.home_care_followup_date?.trim() ||
          '',
        size: 160,
        minSize: 140,
        Cell: ({ row }) => (
          <Text size='sm' className='doctors-mgmt-muted'>
            {patientFollowupDate(row.original)}
          </Text>
        )
      },
      {
        id: 'case_details',
        header: 'Case Details',
        accessorFn: (row) => row.records.length,
        size: 130,
        minSize: 120,
        Cell: ({ row }) => (
          <Button
            variant='light'
            color='cyan'
            size='compact-sm'
            radius='xl'
            leftSection={<IconFileDescription size={15} stroke={1.6} />}
            onClick={() => onViewCaseDetails(row.original)}
          >
            Case Details
          </Button>
        )
      },
      {
        id: 'consultation_notes',
        header: 'Consultation notes',
        accessorFn: (row) => consultationNotesPreview(row) ?? '',
        size: 220,
        minSize: 180,
        Cell: ({ row }) => {
          const request = row.original;
          const hasNotes = hasPatientConsultationNotes(request);

          if (!hasNotes) {
            return (
              <Text size='sm' className='doctors-mgmt-muted'>
                —
              </Text>
            );
          }

          return (
            <Stack gap={6}>
              <Button
                variant='light'
                color='teal'
                size='compact-sm'
                radius='xl'
                leftSection={<IconFileText size={15} stroke={1.6} />}
                onClick={() => onViewConsultationNotes(request)}
              >
                View Previous Consultation
              </Button>
            </Stack>
          );
        }
      },
      {
        id: 'status_action',
        header: 'Status',
        accessorFn: (row) => doctorStatusLabel(row.status),
        size: 190,
        minSize: 160,
        enableColumnFilter: false,
        Cell: ({ row }) => {
          const request = row.original;
          const canConsult = canDoctorGiveConsultation(request);

          return (
            <Stack gap={8} align='flex-start' className='doctor-cases-status-action'>
              <Badge
                variant='dot'
                color={doctorStatusColor(request.status)}
                radius='xl'
                size='lg'
                className='doctors-mgmt-status'
              >
                {doctorStatusLabel(request.status)}
              </Badge>

              {canConsult ? (
                <DoctorGiveConsultationButton
                  request={request}
                  onNavigate={onNavigate}
                  returnScreen={returnScreen}
                  compact
                />
              ) : request.doctor_response?.trim() ? (
                <Badge variant='light' color='green' radius='xl' size='md' className='doctors-mgmt-pill'>
                  Responded
                </Badge>
              ) : null}
            </Stack>
          );
        }
      }
    ],
    [onNavigate, onViewCaseDetails, onViewConsultationNotes, returnScreen]
  );
}

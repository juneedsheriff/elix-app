import { useMemo } from 'react';
import { Anchor, Avatar, Badge, Button, Group, Stack, Text, Tooltip } from '@mantine/core';
import { IconCalendar, IconFileDescription, IconFileText, IconVideo } from '@tabler/icons-react';
import type { MRT_ColumnDef } from 'mantine-react-table';
import {
  canDoctorGiveConsultation,
  consultationNotesPreview,
  hasPatientConsultationNotes
} from '../../lib/doctorConsultation';
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
  if (status === 'closed') return 'Closed';
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

export function useDoctorCasesTableColumns({
  onNavigate,
  returnScreen = 'case-review',
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
        size: 220,
        minSize: 160,
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
        size: 190,
        minSize: 160,
        Cell: ({ row }) => {
          const request = row.original;
          const meetingLink = request.meeting_link?.trim();

          if (!meetingLink) {
            return (
              <Text size='sm' className='doctors-mgmt-muted'>
                —
              </Text>
            );
          }

          return (
            <Stack gap={4}>
              <Group gap={6} wrap='nowrap'>
                <IconVideo size={15} stroke={1.6} />
                <Text size='sm' fw={600}>
                  Video
                </Text>
              </Group>
              {request.scheduled_at ? (
                <Group gap={6} wrap='nowrap'>
                  <IconCalendar size={14} stroke={1.6} />
                  <Text size='xs' c='dimmed' className='doctors-mgmt-muted'>
                    {new Date(request.scheduled_at).toLocaleString()}
                  </Text>
                </Group>
              ) : null}
              <Anchor href={meetingLink} target='_blank' rel='noreferrer' size='xs' fw={600}>
                Join meeting
              </Anchor>
            </Stack>
          );
        }
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
          const preview = consultationNotesPreview(request);
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
              {/* {preview ? (
                <Tooltip label={preview} multiline maw={360} withArrow>
                  <Text size='sm' lineClamp={2} className='doctors-mgmt-muted'>
                    {preview}
                  </Text>
                </Tooltip>
              ) : null} */}
              <Button
                variant='light'
                color='teal'
                size='compact-sm'
                radius='xl'
                leftSection={<IconFileText size={15} stroke={1.6} />}
                onClick={() => onViewConsultationNotes(request)}
              >
                View notes
              </Button>
            </Stack>
          );
        }
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (row) => doctorStatusLabel(row.status),
        size: 140,
        minSize: 120,
        Cell: ({ row }) => (
          <Badge
            variant='dot'
            color={doctorStatusColor(row.original.status)}
            radius='xl'
            size='lg'
            className='doctors-mgmt-status'
          >
            {doctorStatusLabel(row.original.status)}
          </Badge>
        )
      },
      {
        id: 'actions',
        header: '',
        size: 170,
        minSize: 150,
        enableSorting: false,
        enableColumnFilter: false,
        Cell: ({ row }) => {
          const request = row.original;

          if (!canDoctorGiveConsultation(request)) {
            if (request.doctor_response?.trim()) {
              return (
                <Badge variant='light' color='green' radius='xl' size='md' className='doctors-mgmt-pill'>
                  Responded
                </Badge>
              );
            }

            return (
              <Text size='sm' className='doctors-mgmt-muted'>
                —
              </Text>
            );
          }

          return (
            <DoctorGiveConsultationButton
              request={request}
              onNavigate={onNavigate}
              returnScreen={returnScreen}
              compact
            />
          );
        }
      }
    ],
    [onNavigate, onViewCaseDetails, onViewConsultationNotes, returnScreen]
  );
}

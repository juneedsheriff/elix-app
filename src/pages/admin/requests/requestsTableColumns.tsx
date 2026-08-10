import { useMemo } from 'react';
import {
  ActionIcon,
  Avatar,
  Badge,
  Group,
  Stack,
  Text,
  Tooltip
} from '@mantine/core';
import { IconEye, IconTrash } from '@tabler/icons-react';
import type { MRT_ColumnDef } from 'mantine-react-table';
import { formatPatientAvailability } from '../../../lib/doctorSchedule';
import { homeCareServicesFromRequest } from '../../../lib/homeCareServices';
import { staffRequestStatusLabel } from '../../../lib/opinionRequests';
import { avatarColorFromName, displayInitials } from '../../../lib/avatarDisplay';
import type { OpinionRequest } from '../../../types/opinionRequest';
import {
  formatRequestDate,
  requestStatusColor
} from './requestsUtils';

type UseRequestsTableColumnsOptions = {
  isAdmin: boolean;
  requestKind?: 'consultations' | 'homecare';
  onView: (request: OpinionRequest) => void;
  onDelete?: (request: OpinionRequest) => void;
};

function displayCell(value: string | null | undefined) {
  const v = value?.trim();
  return v ? v : '—';
}

export function useRequestsTableColumns({
  isAdmin,
  requestKind = 'consultations',
  onView,
  onDelete
}: UseRequestsTableColumnsOptions) {
  return useMemo<MRT_ColumnDef<OpinionRequest>[]>(
    () => {
      const columns: MRT_ColumnDef<OpinionRequest>[] = [
        {
          accessorKey: 'patient_name',
          header: 'Patient',
          size: 240,
          minSize: 200,
          grow: true,
          enableColumnActions: false,
          Cell: ({ row }) => {
            const request = row.original;
            const name = request.patient_name;
            const initials = displayInitials(name);
            const bg = avatarColorFromName(name);
            return (
              <Group gap='sm' wrap='nowrap' className='doctors-mgmt-doctor-cell'>
                <Avatar
                  alt={name ?? 'Patient'}
                  radius='xl'
                  size={40}
                  className='doctors-mgmt-avatar doctors-mgmt-avatar--initials'
                  styles={{
                    root: {
                      flexShrink: 0,
                      backgroundColor: bg
                    },
                    placeholder: {
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      letterSpacing: '0.02em',
                      backgroundColor: bg
                    }
                  }}
                >
                  {initials}
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
        requestKind === 'homecare'
          ? {
              id: 'homeCareServices',
              header: 'Requested services',
              size: 260,
              minSize: 200,
              grow: true,
              enableColumnActions: false,
              Cell: ({ row }: { row: { original: OpinionRequest } }) => {
                const services = homeCareServicesFromRequest(row.original);
                if (!services.length) {
                  return (
                    <Text size='sm' c='dimmed'>
                      Home Care
                    </Text>
                  );
                }
                return (
                  <Group gap={6} wrap='wrap'>
                    {services.map((service) => (
                      <Badge key={service} size='sm' variant='light' color='teal' radius='sm'>
                        {service}
                      </Badge>
                    ))}
                  </Group>
                );
              }
            }
          : {
              accessorKey: 'doctor_name',
              header: 'Doctor',
              size: 200,
              minSize: 160,
              grow: true,
              enableColumnActions: false,
              Cell: ({ row }: { row: { original: OpinionRequest } }) => {
                const request = row.original;
                const preferredTime = formatPatientAvailability(request.patient_availability);
                const showPatientPick =
                  preferredTime &&
                  (request.consultation_stage === 'availability_submitted' ||
                    request.consultation_stage === 'schedule_proposed' ||
                    request.consultation_stage === 'schedule_confirmed' ||
                    request.consultation_stage === 'doctor_selected');
                return (
                  <Stack gap={2}>
                    <Text size='sm' fw={500}>
                      {displayCell(request.doctor_name)}
                    </Text>
                    {request.doctor_specialty ? (
                      <Text size='xs' c='dimmed' className='doctors-mgmt-muted'>
                        {request.doctor_specialty}
                      </Text>
                    ) : null}
                    {showPatientPick ? (
                      <Text size='xs' c='teal' fw={600} className='doctors-mgmt-muted'>
                        Preferred: {preferredTime.split('\n')[0]}
                      </Text>
                    ) : null}
                  </Stack>
                );
              }
            },
        {
          accessorKey: 'created_at',
          header: 'Submitted',
          size: 120,
          minSize: 110,
          enableColumnActions: false,
          Cell: ({ cell }) => (
            <Text size='sm' className='doctors-mgmt-muted'>
              {formatRequestDate(cell.getValue<string>())}
            </Text>
          )
        },
        {
          id: 'records',
          header: 'Records',
          accessorFn: (row) => row.records.length,
          size: 100,
          minSize: 90,
          enableColumnActions: false,
          Cell: ({ row }) => (
            <Badge variant='light' color='cyan' radius='xl' size='md' className='doctors-mgmt-pill'>
              {row.original.records.length}
            </Badge>
          )
        },
        {
          id: 'status',
          header: 'Status',
          accessorFn: (row) => staffRequestStatusLabel(row),
          size: 200,
          minSize: 170,
          enableColumnActions: false,
          Cell: ({ row }) => {
            const request = row.original;
            return (
              <Badge
                variant='dot'
                color={requestStatusColor(request)}
                radius='xl'
                size='lg'
                className='doctors-mgmt-status'
                style={{ whiteSpace: 'nowrap' }}
              >
                {staffRequestStatusLabel(request)}
              </Badge>
            );
          }
        }
      ];

      if (isAdmin) {
        columns.push({
          id: 'workspace',
          header: 'Workspace',
          accessorFn: (row) => row.clinic_name ?? 'Global',
          size: 160,
          minSize: 140,
          enableColumnActions: false,
          Cell: ({ row }) => (
            <Badge
              variant='light'
              color={row.original.clinic_id ? 'blue' : 'gray'}
              radius='xl'
              size='md'
              className='doctors-mgmt-pill'
            >
              {row.original.clinic_name ?? 'Global'}
            </Badge>
          )
        });

        columns.push({
          id: 'assigned_to',
          header: 'Assigned to',
          accessorFn: (row) => row.assigned_to_name ?? row.assigned_to ?? '',
          size: 160,
          minSize: 140,
          enableColumnActions: false,
          Cell: ({ row }) => {
            const request = row.original;
            const label = request.assigned_to_name?.trim();
            return (
              <Text size='sm' fw={label ? 600 : undefined} className='doctors-mgmt-muted'>
                {label ?? (request.assigned_to ? 'Assigned' : '—')}
              </Text>
            );
          }
        });
      }

      columns.push({
        id: 'actions',
        header: 'Actions',
        size: onDelete ? 110 : 72,
        minSize: onDelete ? 100 : 64,
        enableSorting: false,
        enableColumnFilter: false,
        enableColumnActions: false,
        enablePinning: true,
        Cell: ({ row }) => (
          <Group gap='xs' wrap='nowrap' justify='flex-end' className='doctors-mgmt-actions'>
            <Tooltip label='View request'>
              <ActionIcon
                variant='subtle'
                color='cyan'
                radius='md'
                size='lg'
                className='doctors-mgmt-action'
                aria-label='View request'
                onClick={() => onView(row.original)}
              >
                <IconEye size={18} />
              </ActionIcon>
            </Tooltip>
            {onDelete ? (
              <Tooltip label='Delete request'>
                <ActionIcon
                  variant='subtle'
                  color='red'
                  radius='md'
                  size='lg'
                  className='doctors-mgmt-action'
                  aria-label='Delete request'
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(row.original);
                  }}
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Tooltip>
            ) : null}
          </Group>
        )
      });

      return columns;
    },
    [isAdmin, requestKind, onView, onDelete]
  );
}

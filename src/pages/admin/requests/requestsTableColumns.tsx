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
import { IconEye } from '@tabler/icons-react';
import type { MRT_ColumnDef } from 'mantine-react-table';
import { staffRequestStatusLabel } from '../../../lib/opinionRequests';
import type { OpinionRequest } from '../../../types/opinionRequest';
import {
  formatRequestDate,
  patientInitials,
  requestStatusColor
} from './requestsUtils';

type UseRequestsTableColumnsOptions = {
  isAdmin: boolean;
  onView: (request: OpinionRequest) => void;
};

function displayCell(value: string | null | undefined) {
  const v = value?.trim();
  return v ? v : '—';
}

export function useRequestsTableColumns({ isAdmin, onView }: UseRequestsTableColumnsOptions) {
  return useMemo<MRT_ColumnDef<OpinionRequest>[]>(
    () => {
      const columns: MRT_ColumnDef<OpinionRequest>[] = [
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
          accessorKey: 'doctor_name',
          header: 'Doctor',
          size: 200,
          minSize: 170,
          Cell: ({ row }) => {
            const request = row.original;
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
              </Stack>
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
          id: 'records',
          header: 'Records',
          accessorFn: (row) => row.records.length,
          size: 90,
          minSize: 80,
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
          size: 150,
          minSize: 130,
          Cell: ({ row }) => {
            const request = row.original;
            return (
              <Badge
                variant='dot'
                color={requestStatusColor(request)}
                radius='xl'
                size='lg'
                className='doctors-mgmt-status'
              >
                {staffRequestStatusLabel(request)}
              </Badge>
            );
          }
        }
      ];

      if (isAdmin) {
        columns.push({
          accessorKey: 'assigned_to_name',
          header: 'Assigned to',
          size: 160,
          minSize: 140,
          Cell: ({ cell }) => (
            <Text size='sm' className='doctors-mgmt-muted'>
              {displayCell(cell.getValue<string | null>())}
            </Text>
          )
        });
      }

      columns.push({
        id: 'actions',
        header: '',
        size: 80,
        minSize: 70,
        enableSorting: false,
        enableColumnFilter: false,
        Cell: ({ row }) => (
          <Group gap={4} wrap='nowrap' justify='flex-end' className='doctors-mgmt-actions'>
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
          </Group>
        )
      });

      return columns;
    },
    [isAdmin, onView]
  );
}

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ActionIcon,
  Avatar,
  Badge,
  Code,
  Group,
  Menu,
  Stack,
  Text,
  Tooltip
} from '@mantine/core';
import {
  IconDots,
  IconEye,
  IconMail,
  IconPencil,
  IconPhone,
  IconTrash
} from '@tabler/icons-react';
import type { MRT_ColumnDef } from 'mantine-react-table';
import type { Patient } from '../../../types/patient';
import { patientEditUrl } from '../elixHealthRoutes';
import {
  bloodGroupBadgeColor,
  loginStatusForPatient,
  patientInitials,
  patientLocation
} from './patientsUtils';

type UsePatientsTableColumnsOptions = {
  canEdit: boolean;
  isAdmin: boolean;
  onDeleteAllRequests?: (patient: Patient) => void;
  onDeletePatient?: (patient: Patient) => void;
};

function displayCell(value: string | null | undefined) {
  const v = value?.trim();
  return v ? v : '—';
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

export function usePatientsTableColumns({
  canEdit,
  isAdmin,
  onDeleteAllRequests,
  onDeletePatient
}: UsePatientsTableColumnsOptions) {
  return useMemo<MRT_ColumnDef<Patient>[]>(
    () => [
      {
        accessorKey: 'full_name',
        header: 'Patient',
        size: 260,
        minSize: 220,
        Cell: ({ row }) => {
          const patient = row.original;
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
                {patientInitials(patient.full_name)}
              </Avatar>
              <Stack gap={2} className='doctors-mgmt-doctor-cell__text'>
                <Text
                  component={Link}
                  to={patientEditUrl(patient.id)}
                  fw={700}
                  size='sm'
                  className='doctors-mgmt-link'
                >
                  {patient.full_name}
                </Text>
                <Text size='xs' c='dimmed' className='doctors-mgmt-muted'>
                  {patient.email}
                </Text>
              </Stack>
            </Group>
          );
        }
      },
      {
        accessorKey: 'elix_id',
        header: 'ElixClinix ID',
        size: 120,
        minSize: 100,
        Cell: ({ cell }) => (
          <Code className='doctors-mgmt-code' fz='xs'>
            {cell.getValue<string>()}
          </Code>
        )
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        size: 140,
        minSize: 120,
        Cell: ({ cell }) => (
          <Text size='sm' className='doctors-mgmt-muted'>
            {displayCell(cell.getValue<string | null>())}
          </Text>
        )
      },
      {
        id: 'location',
        header: 'Location',
        accessorFn: (row) => patientLocation(row),
        size: 180,
        minSize: 150,
        filterVariant: 'select',
        Cell: ({ row }) => {
          const patient = row.original;
          return (
            <Stack gap={2}>
              <Text size='sm' fw={500}>
                {displayCell(patient.city)}
              </Text>
              <Text size='xs' c='dimmed' className='doctors-mgmt-muted'>
                {displayCell(patient.country)}
              </Text>
            </Stack>
          );
        }
      },
      ...(isAdmin
        ? [
            {
              id: 'pseWorkspace',
              header: 'PSE clinic',
              size: 200,
              minSize: 160,
              enableSorting: false,
              Cell: ({ row }: { row: { original: Patient } }) => {
                const patient = row.original;
                if (!patient.clinic_id) {
                  return (
                    <Text size='sm' c='dimmed' className='doctors-mgmt-muted'>
                      Platform
                    </Text>
                  );
                }
                return (
                  <Stack gap={2}>
                    <Text size='sm' fw={600}>
                      {displayCell(patient.pse_clinic_name) || 'Clinic workspace'}
                    </Text>
                    <Badge size='xs' variant='light' color='teal' radius='sm'>
                      Clinic patient
                    </Badge>
                  </Stack>
                );
              }
            } as MRT_ColumnDef<Patient>
          ]
        : []),
      {
        accessorKey: 'blood_group',
        header: 'Blood group',
        size: 110,
        minSize: 100,
        filterVariant: 'select',
        Cell: ({ cell }) => {
          const bg = cell.getValue<string | null>();
          if (!bg?.trim()) return <Text size='sm' c='dimmed'>—</Text>;
          return (
            <Badge
              variant='light'
              color={bloodGroupBadgeColor(bg)}
              radius='xl'
              size='md'
              className='doctors-mgmt-pill'
            >
              {bg}
            </Badge>
          );
        }
      },
      {
        accessorKey: 'gender',
        header: 'Gender',
        size: 100,
        minSize: 90,
        Cell: ({ cell }) => (
          <Text size='sm' c='dimmed' className='doctors-mgmt-muted'>
            {displayCell(cell.getValue<string | null>())}
          </Text>
        )
      },
      {
        accessorKey: 'created_at',
        header: 'Joined',
        size: 110,
        minSize: 100,
        enableGlobalFilter: false,
        Cell: ({ cell }) => (
          <Text size='sm' className='doctors-mgmt-muted'>
            {formatDate(cell.getValue<string>())}
          </Text>
        )
      },
      {
        id: 'login',
        header: 'Login',
        accessorFn: (row) => loginStatusForPatient(row).label,
        size: 120,
        minSize: 110,
        Cell: ({ row }) => {
          const status = loginStatusForPatient(row.original);
          return (
            <Badge variant='dot' color={status.color} radius='xl' size='lg' className='doctors-mgmt-status'>
              {status.label}
            </Badge>
          );
        }
      },
      {
        id: 'actions',
        header: '',
        size: 130,
        minSize: 120,
        enableSorting: false,
        enableColumnFilter: false,
        enableGlobalFilter: false,
        enablePinning: true,
        Cell: ({ row }) => {
          const patient = row.original;
          const editPath = patientEditUrl(patient.id);
          return (
            <Group gap='xs' wrap='nowrap' justify='flex-end' className='doctors-mgmt-actions'>
              <Tooltip label={canEdit ? 'Edit profile' : 'View profile'}>
                <ActionIcon
                  component={Link}
                  to={editPath}
                  variant='subtle'
                  color='cyan'
                  radius='md'
                  size='lg'
                  className='doctors-mgmt-action'
                  aria-label={canEdit ? 'Edit patient' : 'View patient'}
                >
                  {canEdit ? <IconPencil size={18} /> : <IconEye size={18} />}
                </ActionIcon>
              </Tooltip>
              {onDeletePatient ? (
                <Tooltip label='Delete patient'>
                  <ActionIcon
                    variant='subtle'
                    color='red'
                    radius='md'
                    size='lg'
                    className='doctors-mgmt-action'
                    aria-label={`Delete ${patient.full_name}`}
                    onClick={() => onDeletePatient(patient)}
                  >
                    <IconTrash size={18} />
                  </ActionIcon>
                </Tooltip>
              ) : null}
              <Menu position='bottom-end' withinPortal shadow='md' radius='md'>
                <Menu.Target>
                  <ActionIcon
                    variant='subtle'
                    color='gray'
                    radius='md'
                    size='lg'
                    className='doctors-mgmt-action'
                    aria-label='More actions'
                  >
                    <IconDots size={18} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item component={Link} to={editPath} leftSection={<IconEye size={16} />}>
                    {canEdit ? 'Open editor' : 'View profile'}
                  </Menu.Item>
                  {patient.email ? (
                    <Menu.Item
                      component='a'
                      href={`mailto:${patient.email}`}
                      leftSection={<IconMail size={16} />}
                    >
                      Email patient
                    </Menu.Item>
                  ) : null}
                  {patient.phone ? (
                    <Menu.Item
                      component='a'
                      href={`tel:${patient.phone}`}
                      leftSection={<IconPhone size={16} />}
                    >
                      Call patient
                    </Menu.Item>
                  ) : null}
                  {onDeleteAllRequests ? (
                    <Menu.Item
                      color='red'
                      leftSection={<IconTrash size={16} />}
                      disabled={!patient.auth_user_id}
                      onClick={() => onDeleteAllRequests(patient)}
                    >
                      Delete all opinion requests
                    </Menu.Item>
                  ) : null}
                  {onDeletePatient ? (
                    <Menu.Item
                      color='red'
                      leftSection={<IconTrash size={16} />}
                      onClick={() => onDeletePatient(patient)}
                    >
                      Delete patient
                    </Menu.Item>
                  ) : null}
                </Menu.Dropdown>
              </Menu>
            </Group>
          );
        }
      }
    ],
    [canEdit, isAdmin, onDeleteAllRequests, onDeletePatient]
  );
}

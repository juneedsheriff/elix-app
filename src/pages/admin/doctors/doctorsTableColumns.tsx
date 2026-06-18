import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ActionIcon,
  Avatar,
  Badge,
  Group,
  Menu,
  Paper,
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
import { formatConsultationFeeUsd } from '../../../lib/doctors';
import type { Doctor } from '../../../types/doctor';
import { doctorEditUrl } from '../elixHealthRoutes';
import {
  doctorClinicName,
  doctorCountry,
  doctorInitials,
  doctorMobile,
  loginStatusForDoctor,
  specialtyBadgeColor
} from './doctorsUtils';

type UseDoctorsTableColumnsOptions = {
  canEdit: boolean;
  onDeleteDoctor?: (doctor: Doctor) => void;
};

function displayCell(value: string | null | undefined) {
  const v = value?.trim();
  return v ? v : '—';
}

export function useDoctorsTableColumns({ canEdit, onDeleteDoctor }: UseDoctorsTableColumnsOptions) {
  return useMemo<MRT_ColumnDef<Doctor>[]>(
    () => [
      {
        accessorKey: 'full_name',
        header: 'Doctor',
        size: 260,
        minSize: 220,
        Cell: ({ row }) => {
          const doctor = row.original;
          return (
            <Group gap='sm' wrap='nowrap' className='doctors-mgmt-doctor-cell'>
              <Avatar
                radius='xl'
                size={40}
                variant='filled'
                className='doctors-mgmt-avatar'
                styles={{
                  root: {
                    flexShrink: 0
                  },
                  placeholder: {
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.8rem'
                  }
                }}
              >
                {doctorInitials(doctor.full_name)}
              </Avatar>
              <Stack gap={2} className='doctors-mgmt-doctor-cell__text'>
                <Text
                  component={Link}
                  to={doctorEditUrl(doctor.id)}
                  fw={700}
                  size='sm'
                  className='doctors-mgmt-link'
                >
                  {doctor.full_name}
                </Text>
                <Text size='xs' c='dimmed' className='doctors-mgmt-muted'>
                  {doctor.email}
                </Text>
              </Stack>
            </Group>
          );
        }
      },
      {
        accessorKey: 'specialty',
        header: 'Specialty',
        size: 150,
        minSize: 130,
        filterVariant: 'select',
        Cell: ({ cell }) => {
          const specialty = cell.getValue<string>();
          return (
            <Badge
              variant='light'
              color={specialtyBadgeColor(specialty)}
              radius='xl'
              size='md'
              className='doctors-mgmt-pill'
            >
              {specialty}
            </Badge>
          );
        }
      },
      {
        id: 'clinic',
        header: 'Clinic',
        accessorFn: (row) => doctorClinicName(row),
        size: 200,
        minSize: 160,
        Cell: ({ row }) => {
          const clinic = doctorClinicName(row.original);
          const city = row.original.clinic_city?.trim();
          return (
            <Stack gap={2}>
              <Text size='sm' fw={500}>
                {displayCell(clinic)}
              </Text>
              <Text size='xs' c='dimmed' className='doctors-mgmt-muted'>
                {displayCell(city)}
              </Text>
            </Stack>
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
        id: 'mobile',
        header: 'Mobile',
        accessorFn: (row) => doctorMobile(row),
        size: 140,
        minSize: 120,
        Cell: ({ cell }) => (
          <Text size='sm' className='doctors-mgmt-muted'>
            {displayCell(cell.getValue<string | null>())}
          </Text>
        )
      },
      {
        id: 'country',
        header: 'Country',
        accessorFn: (row) => doctorCountry(row),
        size: 120,
        minSize: 100,
        filterVariant: 'select',
        Cell: ({ cell }) => (
          <Text size='sm' className='doctors-mgmt-muted'>
            {displayCell(cell.getValue<string | null>())}
          </Text>
        )
      },
      {
        id: 'fee',
        header: 'Fee',
        accessorFn: (row) =>
          formatConsultationFeeUsd(
            row.consultation_fee ?? row.fee_usd,
            row.consultation_currency ?? 'USD'
          ),
        size: 110,
        minSize: 100,
        enableGlobalFilter: false,
        Cell: ({ cell }) => (
          <Paper radius='md' px='sm' py={6} className='doctors-mgmt-fee'>
            <Text size='sm' fw={700}>
              {cell.getValue<string>()}
            </Text>
          </Paper>
        )
      },
      {
        id: 'login',
        header: 'Login',
        accessorFn: (row) => loginStatusForDoctor(row).label,
        size: 120,
        minSize: 110,
        filterVariant: 'select',
        Cell: ({ row }) => {
          const status = loginStatusForDoctor(row.original);
          return (
            <Badge
              variant='dot'
              color={status.color}
              radius='xl'
              size='lg'
              className='doctors-mgmt-status'
            >
              {status.label}
            </Badge>
          );
        }
      },
      {
        id: 'actions',
        header: '',
        size: 150,
        minSize: 130,
        enableSorting: false,
        enableColumnFilter: false,
        enableGlobalFilter: false,
        Cell: ({ row }) => {
          const doctor = row.original;
          const editPath = doctorEditUrl(doctor.id);
          return (
            <Group gap={4} wrap='nowrap' justify='flex-end' className='doctors-mgmt-actions'>
              <Tooltip label={canEdit ? 'Edit profile' : 'View profile'}>
                <ActionIcon
                  component={Link}
                  to={editPath}
                  variant='subtle'
                  color='cyan'
                  radius='md'
                  size='lg'
                  className='doctors-mgmt-action'
                  aria-label={canEdit ? 'Edit doctor' : 'View doctor'}
                >
                  {canEdit ? <IconPencil size={18} /> : <IconEye size={18} />}
                </ActionIcon>
              </Tooltip>
              {canEdit && onDeleteDoctor ? (
                <Tooltip label='Delete doctor'>
                  <ActionIcon
                    variant='subtle'
                    color='red'
                    radius='md'
                    size='lg'
                    className='doctors-mgmt-action'
                    aria-label={`Delete ${doctor.full_name}`}
                    onClick={() => onDeleteDoctor(doctor)}
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
                  {doctor.email ? (
                    <Menu.Item
                      component='a'
                      href={`mailto:${doctor.email}`}
                      leftSection={<IconMail size={16} />}
                    >
                      Email doctor
                    </Menu.Item>
                  ) : null}
                  {doctorMobile(doctor) ? (
                    <Menu.Item
                      component='a'
                      href={`tel:${doctorMobile(doctor)}`}
                      leftSection={<IconPhone size={16} />}
                    >
                      Call doctor
                    </Menu.Item>
                  ) : null}
                  {canEdit && onDeleteDoctor ? (
                    <Menu.Item
                      color='red'
                      leftSection={<IconTrash size={16} />}
                      onClick={() => onDeleteDoctor(doctor)}
                    >
                      Delete doctor
                    </Menu.Item>
                  ) : null}
                </Menu.Dropdown>
              </Menu>
            </Group>
          );
        }
      }
    ],
    [canEdit, onDeleteDoctor]
  );
}

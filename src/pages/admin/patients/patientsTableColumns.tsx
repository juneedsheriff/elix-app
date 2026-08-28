import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Code,
  Group,
  Menu,
  Stack,
  Text,
  Tooltip
} from '@mantine/core';
import {
  IconBuildingCommunity,
  IconBuildingOff,
  IconDots,
  IconEye,
  IconHomeHeart,
  IconMail,
  IconPencil,
  IconPhone,
  IconStethoscope,
  IconTrash
} from '@tabler/icons-react';
import type { MRT_ColumnDef } from 'mantine-react-table';
import type { Patient } from '../../../types/patient';
import { avatarColorFromName, displayInitials, resolveProfilePhotoUrl } from '../../../lib/avatarDisplay';
import { formatConsultationFollowupDate } from '../../../lib/consultationSummaryFields';
import { patientEditUrl } from '../elixHealthRoutes';
import {
  bloodGroupBadgeColor,
  loginStatusForPatient,
  patientLocation
} from './patientsUtils';

type UsePatientsTableColumnsOptions = {
  canEdit: boolean;
  isAdmin: boolean;
  onAssignToClinic?: (patient: Patient) => void;
  onRemoveFromClinic?: (patient: Patient) => void;
  onDeleteAllRequests?: (patient: Patient) => void;
  onDeletePatient?: (patient: Patient) => void;
  onBookConsultation?: (patient: Patient) => void;
  onRequestHomeCare?: (patient: Patient) => void;
};

function displayCell(value: string | null | undefined) {
  const v = value?.trim();
  return v ? v : '—';
}

export function usePatientsTableColumns({
  canEdit,
  isAdmin,
  onAssignToClinic,
  onRemoveFromClinic,
  onDeleteAllRequests,
  onDeletePatient,
  onBookConsultation,
  onRequestHomeCare
}: UsePatientsTableColumnsOptions) {
  return useMemo<MRT_ColumnDef<Patient>[]>(
    () => [
      {
        accessorKey: 'full_name',
        header: 'Patient',
        size: 300,
        minSize: 260,
        Cell: ({ row }) => {
          const patient = row.original;
          const photoUrl = resolveProfilePhotoUrl(patient.avatar_url);
          const initials = displayInitials(patient.full_name);
          const bg = avatarColorFromName(patient.full_name);
          return (
            <Group gap='sm' wrap='nowrap' className='doctors-mgmt-doctor-cell'>
              <Avatar
                src={photoUrl ?? undefined}
                alt={patient.full_name}
                radius='xl'
                size={40}
                className={
                  photoUrl
                    ? 'doctors-mgmt-avatar doctors-mgmt-avatar--photo'
                    : 'doctors-mgmt-avatar doctors-mgmt-avatar--initials'
                }
                styles={{
                  root: {
                    flexShrink: 0,
                    backgroundColor: photoUrl ? undefined : bg
                  },
                  placeholder: {
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    letterSpacing: '0.02em',
                    backgroundColor: photoUrl ? undefined : bg
                  },
                  image: { objectFit: 'cover' }
                }}
              >
                {initials}
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
                <Text size='xs' c='dimmed' className='doctors-mgmt-muted'>
                  {displayCell(patient.phone)}
                </Text>
              </Stack>
            </Group>
          );
        }
      },
      {
        accessorKey: 'elix_id',
        header: 'Elix ID',
        size: 140,
        minSize: 120,
        enableColumnActions: false,
        Cell: ({ cell }) => (
          <Code className='doctors-mgmt-code' fz='xs'>
            {cell.getValue<string>()}
          </Code>
        )
      },
      {
        id: 'location',
        header: 'Location',
        accessorFn: (row) => patientLocation(row),
        size: 160,
        minSize: 140,
        enableColumnActions: false,
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
              size: 180,
              minSize: 160,
              enableSorting: false,
              enableColumnActions: false,
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
        size: 130,
        minSize: 120,
        enableColumnActions: false,
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
        id: 'followup_date',
        header: 'Follow-up Date',
        accessorFn: (row) => row.consultation_followup_date ?? '',
        size: 150,
        minSize: 130,
        enableColumnActions: false,
        Cell: ({ row }) => {
          const formatted = formatConsultationFollowupDate(row.original.consultation_followup_date);
          return (
            <Text size='sm' c={formatted ? undefined : 'dimmed'}>
              {formatted || '—'}
            </Text>
          );
        }
      },
      {
        id: 'login',
        header: 'Login status',
        accessorFn: (row) => loginStatusForPatient(row).label,
        size: 150,
        minSize: 130,
        enableColumnActions: false,
        Cell: ({ row }) => {
          const status = loginStatusForPatient(row.original);
          return (
            <Badge variant='dot' color={status.color} radius='xl' size='lg' className='doctors-mgmt-status'>
              {status.label}
            </Badge>
          );
        }
      },
      ...(onBookConsultation || onRequestHomeCare
        ? [
            {
              id: 'bookServices',
              header: onRequestHomeCare ? 'Book / request' : 'Book Consultation',
              size: onRequestHomeCare ? 220 : 180,
              minSize: onRequestHomeCare ? 200 : 160,
              enableSorting: false,
              enableColumnFilter: false,
              enableGlobalFilter: false,
              enableColumnActions: false,
              Cell: ({ row }: { row: { original: Patient } }) => {
                const patient = row.original;
                return (
                  <Stack gap={6}>
                    {onBookConsultation ? (
                      <Button
                        size='compact-sm'
                        radius='md'
                        variant='outline'
                        color='cyan'
                        leftSection={<IconStethoscope size={14} />}
                        onClick={() => onBookConsultation(patient)}
                      >
                        Book Consultation
                      </Button>
                    ) : null}
                    {onRequestHomeCare ? (
                      <Button
                        size='compact-sm'
                        radius='md'
                        variant='outline'
                        color='teal'
                        leftSection={<IconHomeHeart size={14} />}
                        onClick={() => onRequestHomeCare(patient)}
                      >
                        Request Home Care
                      </Button>
                    ) : null}
                  </Stack>
                );
              }
            } as MRT_ColumnDef<Patient>
          ]
        : []),
      {
        id: 'actions',
        header: 'Actions',
        size: 120,
        minSize: 110,
        enableSorting: false,
        enableColumnFilter: false,
        enableGlobalFilter: false,
        enableColumnActions: false,
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
                  {onAssignToClinic ? (
                    <Menu.Item
                      leftSection={<IconBuildingCommunity size={16} />}
                      onClick={() => onAssignToClinic(patient)}
                    >
                      {patient.clinic_id ? 'Change clinic' : 'Assign to clinic'}
                    </Menu.Item>
                  ) : null}
                  {onRemoveFromClinic && patient.clinic_id ? (
                    <Menu.Item
                      leftSection={<IconBuildingOff size={16} />}
                      onClick={() => onRemoveFromClinic(patient)}
                    >
                      Remove from clinic
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
    [
      canEdit,
      isAdmin,
      onAssignToClinic,
      onRemoveFromClinic,
      onDeleteAllRequests,
      onDeletePatient,
      onBookConsultation,
      onRequestHomeCare
    ]
  );
}

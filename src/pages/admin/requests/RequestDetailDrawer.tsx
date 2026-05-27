import {
  Badge,
  Button,
  Divider,
  Drawer,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  Title
} from '@mantine/core';
import { IconFileText, IconSend } from '@tabler/icons-react';
import {
  isAssignedToPatientService,
  isPendingAdminAssignment,
  staffRequestStatusLabel
} from '../../../lib/opinionRequests';
import type { Admin } from '../../../types/admin';
import type { OpinionRequest } from '../../../types/opinionRequest';
import { formatRequestDate, requestStatusColor } from './requestsUtils';

type RequestDetailDrawerProps = {
  request: OpinionRequest | null;
  opened: boolean;
  onClose: () => void;
  isAdmin: boolean;
  isPse: boolean;
  executives: Admin[];
  assigneeId: string;
  onAssigneeChange: (value: string) => void;
  coordinationNotes: string;
  onCoordinationNotesChange: (value: string) => void;
  busy: boolean;
  onAssign: () => void;
  onForward: () => void;
  onOpenRecord: (storagePath: string) => void;
};

export default function RequestDetailDrawer({
  request,
  opened,
  onClose,
  isAdmin,
  isPse,
  executives,
  assigneeId,
  onAssigneeChange,
  coordinationNotes,
  onCoordinationNotesChange,
  busy,
  onAssign,
  onForward,
  onOpenRecord
}: RequestDetailDrawerProps) {
  if (!request) return null;

  const canAssign = isAdmin && isPendingAdminAssignment(request);
  const canForward = isPse && isAssignedToPatientService(request);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title='Request details'
      position='right'
      size='lg'
      radius='md'
      classNames={{ content: 'doctors-mgmt-drawer' }}
    >
      <Stack gap='lg'>
        <Group justify='space-between' align='flex-start' wrap='wrap'>
          <Stack gap={4}>
            <Title order={4}>{request.patient_name ?? 'Patient'}</Title>
            {request.patient_email ? (
              <Text size='sm' c='dimmed'>
                {request.patient_email}
              </Text>
            ) : null}
          </Stack>
          <Badge
            variant='dot'
            color={requestStatusColor(request)}
            radius='xl'
            size='lg'
            className='doctors-mgmt-status'
          >
            {staffRequestStatusLabel(request)}
          </Badge>
        </Group>

        <Paper radius='md' p='md' className='doctors-mgmt-detail-block'>
          <Stack gap='xs'>
            <Text size='sm'>
              <Text span fw={600}>
                Doctor:{' '}
              </Text>
              {request.doctor_name ?? '—'}
              {request.doctor_specialty ? ` · ${request.doctor_specialty}` : ''}
            </Text>
            <Text size='sm' c='dimmed'>
              Submitted {formatRequestDate(request.created_at)}
            </Text>
            {request.assigned_to_name ? (
              <Text size='sm'>
                <Text span fw={600}>
                  Assigned to:{' '}
                </Text>
                {request.assigned_to_name}
              </Text>
            ) : null}
          </Stack>
        </Paper>

        <Stack gap='xs'>
          <Text size='sm' fw={600}>
            Patient message
          </Text>
          <Text size='sm'>{request.message}</Text>
        </Stack>

        {request.coordination_notes ? (
          <Stack gap='xs'>
            <Text size='sm' fw={600}>
              Coordination notes
            </Text>
            <Text size='sm'>{request.coordination_notes}</Text>
          </Stack>
        ) : null}

        <Stack gap='sm'>
          <Text size='sm' fw={600}>
            Medical records ({request.records.length})
          </Text>
          {request.records.length > 0 ? (
            <Stack gap='xs'>
              {request.records.map((record) => (
                <Paper key={record.id} radius='md' p='sm' withBorder>
                  <Group justify='space-between' align='flex-start' wrap='nowrap'>
                    <Group gap='sm' wrap='nowrap' align='flex-start'>
                      <IconFileText size={18} stroke={1.5} />
                      <Stack gap={2}>
                        <Text size='sm' fw={600}>
                          {record.file_name}
                        </Text>
                        {record.summary ? (
                          <Text size='xs' c='dimmed'>
                            {record.summary}
                          </Text>
                        ) : null}
                      </Stack>
                    </Group>
                    {record.storage_path ? (
                      <Button
                        variant='light'
                        color='cyan'
                        size='xs'
                        radius='md'
                        onClick={() => onOpenRecord(record.storage_path!)}
                      >
                        Open
                      </Button>
                    ) : null}
                  </Group>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Text size='sm' c='dimmed'>
              No medical records attached.
            </Text>
          )}
        </Stack>

        {request.doctor_response ? (
          <Paper radius='md' p='md' className='doctors-mgmt-detail-block'>
            <Stack gap='xs'>
              <Text size='sm' fw={600}>
                Doctor&apos;s opinion
              </Text>
              <Text size='sm'>{request.doctor_response}</Text>
            </Stack>
          </Paper>
        ) : null}

        {canAssign || canForward ? (
          <>
            <Divider />
            {canAssign ? (
              <Stack gap='sm'>
                <Text size='sm' fw={600}>
                  Assign to Patient Service Executive
                </Text>
                <Select
                  placeholder='Select executive…'
                  data={executives.map((executive) => ({
                    value: executive.id,
                    label: executive.full_name
                  }))}
                  value={assigneeId || null}
                  onChange={(value) => onAssigneeChange(value ?? '')}
                  searchable
                />
                <Button
                  radius='md'
                  className='doctors-mgmt-header__primary'
                  disabled={busy || !assigneeId || executives.length === 0}
                  loading={busy}
                  onClick={onAssign}
                >
                  Assign request
                </Button>
                {executives.length === 0 ? (
                  <Text size='xs' c='dimmed'>
                    Add a staff account with role Patient Service Executive to assign requests.
                  </Text>
                ) : null}
              </Stack>
            ) : null}

            {canForward ? (
              <Stack gap='sm'>
                <Text size='sm' fw={600}>
                  Forward to doctor
                </Text>
                <Textarea
                  label='Coordination notes (optional)'
                  placeholder='Notes for the doctor about patient coordination…'
                  minRows={3}
                  value={coordinationNotes}
                  onChange={(event) => onCoordinationNotesChange(event.currentTarget.value)}
                />
                <Button
                  radius='md'
                  className='doctors-mgmt-header__primary'
                  leftSection={<IconSend size={16} />}
                  disabled={busy}
                  loading={busy}
                  onClick={onForward}
                >
                  Send to doctor
                </Button>
              </Stack>
            ) : null}
          </>
        ) : null}
      </Stack>
    </Drawer>
  );
}

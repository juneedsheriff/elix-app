import { Button, Drawer, Select, Stack, Text } from '@mantine/core';
import { IconFilterOff } from '@tabler/icons-react';
import type { RequestQuickFilters, RequestQueueFilter, RequestStatusFilter } from './requestsUtils';

type RequestsFilterDrawerProps = {
  opened: boolean;
  onClose: () => void;
  filters: RequestQuickFilters;
  specialtyOptions: string[];
  assigneeOptions: string[];
  showAssignee: boolean;
  onChange: (filters: RequestQuickFilters) => void;
  onReset: () => void;
};

const QUEUE_OPTIONS: { value: RequestQueueFilter; label: string }[] = [
  { value: 'pending', label: 'Pending queue' },
  { value: 'all', label: 'All requests' }
];

const STATUS_OPTIONS: { value: RequestStatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending_assignment', label: 'Pending assignment' },
  { value: 'with_patient_service', label: 'With patient service' },
  { value: 'with_doctor', label: 'With doctor' },
  { value: 'closed', label: 'Closed' }
];

export default function RequestsFilterDrawer({
  opened,
  onClose,
  filters,
  specialtyOptions,
  assigneeOptions,
  showAssignee,
  onChange,
  onReset
}: RequestsFilterDrawerProps) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title='Filter requests'
      position='right'
      size='md'
      radius='md'
      classNames={{ content: 'doctors-mgmt-drawer' }}
    >
      <Stack gap='lg'>
        <Text size='sm' c='dimmed'>
          Refine the queue by workflow stage, specialty, and assignee.
        </Text>

        <Select
          label='Queue'
          data={QUEUE_OPTIONS}
          value={filters.queue}
          onChange={(value) =>
            onChange({ ...filters, queue: (value as RequestQueueFilter) ?? 'pending' })
          }
        />

        <Select
          label='Status'
          data={STATUS_OPTIONS}
          value={filters.status}
          onChange={(value) =>
            onChange({ ...filters, status: (value as RequestStatusFilter) ?? 'all' })
          }
        />

        <Select
          label='Doctor specialty'
          placeholder='All specialties'
          clearable
          searchable
          data={specialtyOptions}
          value={filters.specialty}
          onChange={(value) => onChange({ ...filters, specialty: value })}
        />

        {showAssignee ? (
          <Select
            label='Assigned to'
            placeholder='All executives'
            clearable
            searchable
            data={assigneeOptions}
            value={filters.assignee}
            onChange={(value) => onChange({ ...filters, assignee: value })}
          />
        ) : null}

        <Button
          variant='light'
          color='gray'
          radius='md'
          leftSection={<IconFilterOff size={16} />}
          onClick={onReset}
        >
          Reset filters
        </Button>
      </Stack>
    </Drawer>
  );
}

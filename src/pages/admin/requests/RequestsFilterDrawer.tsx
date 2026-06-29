import { Button, Drawer, Select, Stack, Text } from '@mantine/core';
import { IconFilterOff } from '@tabler/icons-react';
import type {
  RequestQuickFilters,
  RequestQueueFilter,
  RequestStatusFilter,
  RequestWorkspaceFilter
} from './requestsUtils';

type RequestsFilterDrawerProps = {
  opened: boolean;
  onClose: () => void;
  filters: RequestQuickFilters;
  specialtyOptions: string[];
  workspaceOptions: Array<{ value: RequestWorkspaceFilter; label: string }>;
  assigneeOptions: string[];
  showAssignee: boolean;
  onChange: (filters: RequestQuickFilters) => void;
  onReset: () => void;
};

const QUEUE_OPTIONS: { value: RequestQueueFilter; label: string }[] = [
  { value: 'all', label: 'All requests' },
  { value: 'pending', label: 'Pending requests' },
  { value: 'assigned', label: 'Assigned to PSE' },
  { value: 'completed', label: 'Completed requests' }
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
  workspaceOptions,
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
            onChange({ ...filters, queue: (value as RequestQueueFilter) ?? filters.queue })
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

        {workspaceOptions.length ? (
          <Select
            label='Workspace'
            data={workspaceOptions}
            value={filters.workspace}
            onChange={(value) =>
              onChange({
                ...filters,
                workspace: (value as RequestWorkspaceFilter) ?? filters.workspace
              })
            }
          />
        ) : null}

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

import { memo } from 'react';
import { ActionIcon, Group, Select, TextInput, Tooltip } from '@mantine/core';
import { IconMaximize, IconMinimize, IconSearch } from '@tabler/icons-react';
import { MRT_ShowHideColumnsButton, type MRT_TableInstance } from 'mantine-react-table';
import type { OpinionRequest } from '../../../types/opinionRequest';
import type { RequestQuickFilters, RequestQueueFilter } from './requestsUtils';

type RequestsTableToolbarProps = {
  table: MRT_TableInstance<OpinionRequest>;
  fullScreen: boolean;
  onToggleFullScreen: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  filters: RequestQuickFilters;
  specialtyOptions: string[];
  pendingCount: number;
  totalCount: number;
  onFilterChange: (filters: RequestQuickFilters) => void;
};

const QUEUE_QUICK: { value: RequestQueueFilter; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'all', label: 'All' }
];

function RequestsTableToolbar({
  table,
  fullScreen,
  onToggleFullScreen,
  search,
  onSearchChange,
  filters,
  specialtyOptions,
  pendingCount,
  totalCount,
  onFilterChange
}: RequestsTableToolbarProps) {
  const queueData = QUEUE_QUICK.map((option) => ({
    ...option,
    label:
      option.value === 'pending'
        ? `${option.label} (${pendingCount})`
        : `${option.label} (${totalCount})`
  }));

  return (
    <div className='doctors-mgmt-table-toolbar__inner'>
      <TextInput
        className='doctors-mgmt-search'
        placeholder='Search by patient, doctor, message, or assignee…'
        value={search}
        onChange={(event) => onSearchChange(event.currentTarget.value)}
        leftSection={<IconSearch size={18} stroke={1.5} />}
        radius='md'
        size='md'
      />

      <Group gap='sm' className='doctors-mgmt-quick-filters' wrap='wrap'>
        <Select
          className='doctors-mgmt-quick-select'
          placeholder='Queue'
          data={queueData}
          value={filters.queue}
          onChange={(value) =>
            onFilterChange({ ...filters, queue: (value as RequestQueueFilter) ?? filters.queue })
          }
          radius='md'
        />
        <Select
          className='doctors-mgmt-quick-select'
          placeholder='Specialty'
          clearable
          searchable
          data={specialtyOptions}
          value={filters.specialty}
          onChange={(value) => onFilterChange({ ...filters, specialty: value })}
          radius='md'
        />
      </Group>

      <Group gap='xs' className='doctors-mgmt-table-toolbar__tools' wrap='nowrap'>
        <MRT_ShowHideColumnsButton table={table} />
        <Tooltip label={fullScreen ? 'Exit full screen' : 'Full screen'}>
          <ActionIcon
            variant='subtle'
            color='gray'
            size='lg'
            radius='md'
            aria-label={fullScreen ? 'Exit full screen' : 'Full screen'}
            onClick={onToggleFullScreen}
          >
            {fullScreen ? <IconMinimize size={18} /> : <IconMaximize size={18} />}
          </ActionIcon>
        </Tooltip>
      </Group>
    </div>
  );
}

export default memo(RequestsTableToolbar);

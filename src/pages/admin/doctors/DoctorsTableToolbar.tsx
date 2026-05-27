import { memo } from 'react';
import { ActionIcon, Group, Select, TextInput, Tooltip } from '@mantine/core';
import { IconMaximize, IconMinimize, IconSearch } from '@tabler/icons-react';
import { MRT_ShowHideColumnsButton, type MRT_TableInstance } from 'mantine-react-table';
import type { Doctor } from '../../../types/doctor';
import type { DoctorQuickFilters, LoginFilter } from './doctorsUtils';

type DoctorsTableToolbarProps = {
  table: MRT_TableInstance<Doctor>;
  fullScreen: boolean;
  onToggleFullScreen: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  filters: DoctorQuickFilters;
  specialtyOptions: string[];
  countryOptions: string[];
  onFilterChange: (filters: DoctorQuickFilters) => void;
};

const LOGIN_QUICK: { value: LoginFilter; label: string }[] = [
  { value: 'all', label: 'All logins' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'none', label: 'No login' }
];

function DoctorsTableToolbar({
  table,
  fullScreen,
  onToggleFullScreen,
  search,
  onSearchChange,
  filters,
  specialtyOptions,
  countryOptions,
  onFilterChange
}: DoctorsTableToolbarProps) {
  return (
    <div className='doctors-mgmt-table-toolbar__inner'>
      <TextInput
        className='doctors-mgmt-search'
        placeholder='Search doctors by name, email, clinic…'
        value={search}
        onChange={(event) => onSearchChange(event.currentTarget.value)}
        leftSection={<IconSearch size={18} stroke={1.5} />}
        radius='md'
        size='md'
      />

      <Group gap='sm' className='doctors-mgmt-quick-filters' wrap='wrap'>
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
        <Select
          className='doctors-mgmt-quick-select'
          placeholder='Country'
          clearable
          searchable
          data={countryOptions}
          value={filters.country}
          onChange={(value) => onFilterChange({ ...filters, country: value })}
          radius='md'
        />
        <Select
          className='doctors-mgmt-quick-select'
          placeholder='Login status'
          data={LOGIN_QUICK}
          value={filters.login}
          onChange={(value) =>
            onFilterChange({ ...filters, login: (value as LoginFilter) ?? 'all' })
          }
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

export default memo(DoctorsTableToolbar);

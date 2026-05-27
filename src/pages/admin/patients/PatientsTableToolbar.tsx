import { memo } from 'react';
import { ActionIcon, Group, Select, TextInput, Tooltip } from '@mantine/core';
import { IconMaximize, IconMinimize, IconSearch } from '@tabler/icons-react';
import { MRT_ShowHideColumnsButton, type MRT_TableInstance } from 'mantine-react-table';
import type { Patient } from '../../../types/patient';
import type { LoginFilter, PatientQuickFilters } from './patientsUtils';

type PatientsTableToolbarProps = {
  table: MRT_TableInstance<Patient>;
  fullScreen: boolean;
  onToggleFullScreen: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  filters: PatientQuickFilters;
  countryOptions: string[];
  cityOptions: string[];
  onFilterChange: (filters: PatientQuickFilters) => void;
};

const LOGIN_QUICK: { value: LoginFilter; label: string }[] = [
  { value: 'all', label: 'All logins' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'none', label: 'No login' }
];

function PatientsTableToolbar({
  table,
  fullScreen,
  onToggleFullScreen,
  search,
  onSearchChange,
  filters,
  countryOptions,
  cityOptions,
  onFilterChange
}: PatientsTableToolbarProps) {
  return (
    <div className='doctors-mgmt-table-toolbar__inner'>
      <TextInput
        className='doctors-mgmt-search'
        placeholder='Search by name, Elix ID, email, phone, or location…'
        value={search}
        onChange={(event) => onSearchChange(event.currentTarget.value)}
        leftSection={<IconSearch size={18} stroke={1.5} />}
        radius='md'
        size='md'
      />

      <Group gap='sm' className='doctors-mgmt-quick-filters' wrap='wrap'>
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
          placeholder='City'
          clearable
          searchable
          data={cityOptions}
          value={filters.city}
          onChange={(value) => onFilterChange({ ...filters, city: value })}
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

export default memo(PatientsTableToolbar);

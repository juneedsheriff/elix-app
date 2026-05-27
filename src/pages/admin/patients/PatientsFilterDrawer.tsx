import { Button, Drawer, Select, Stack, Text } from '@mantine/core';
import { IconFilterOff } from '@tabler/icons-react';
import type { LoginFilter, PatientQuickFilters } from './patientsUtils';

type PatientsFilterDrawerProps = {
  opened: boolean;
  onClose: () => void;
  filters: PatientQuickFilters;
  countryOptions: string[];
  cityOptions: string[];
  bloodGroupOptions: string[];
  onChange: (filters: PatientQuickFilters) => void;
  onReset: () => void;
};

const LOGIN_OPTIONS: { value: LoginFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'none', label: 'No login' }
];

export default function PatientsFilterDrawer({
  opened,
  onClose,
  filters,
  countryOptions,
  cityOptions,
  bloodGroupOptions,
  onChange,
  onReset
}: PatientsFilterDrawerProps) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title='Filter patients'
      position='right'
      size='md'
      radius='md'
      classNames={{ content: 'doctors-mgmt-drawer' }}
    >
      <Stack gap='lg'>
        <Text size='sm' c='dimmed'>
          Refine the directory by location, blood group, and login access.
        </Text>

        <Select
          label='Country'
          placeholder='All countries'
          clearable
          searchable
          data={countryOptions}
          value={filters.country}
          onChange={(value) => onChange({ ...filters, country: value })}
        />

        <Select
          label='City'
          placeholder='All cities'
          clearable
          searchable
          data={cityOptions}
          value={filters.city}
          onChange={(value) => onChange({ ...filters, city: value })}
        />

        <Select
          label='Blood group'
          placeholder='All blood groups'
          clearable
          searchable
          data={bloodGroupOptions}
          value={filters.bloodGroup}
          onChange={(value) => onChange({ ...filters, bloodGroup: value })}
        />

        <Select
          label='Login status'
          data={LOGIN_OPTIONS}
          value={filters.login}
          onChange={(value) =>
            onChange({ ...filters, login: (value as LoginFilter) ?? 'all' })
          }
        />

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

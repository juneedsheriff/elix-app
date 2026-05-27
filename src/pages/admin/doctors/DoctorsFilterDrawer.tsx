import { Button, Drawer, Select, Stack, Text } from '@mantine/core';
import { IconFilterOff } from '@tabler/icons-react';
import type { DoctorQuickFilters, LoginFilter } from './doctorsUtils';

type DoctorsFilterDrawerProps = {
  opened: boolean;
  onClose: () => void;
  filters: DoctorQuickFilters;
  specialtyOptions: string[];
  countryOptions: string[];
  onChange: (filters: DoctorQuickFilters) => void;
  onReset: () => void;
};

const LOGIN_OPTIONS: { value: LoginFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'none', label: 'No login' }
];

export default function DoctorsFilterDrawer({
  opened,
  onClose,
  filters,
  specialtyOptions,
  countryOptions,
  onChange,
  onReset
}: DoctorsFilterDrawerProps) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title='Filter doctors'
      position='right'
      size='md'
      radius='md'
      classNames={{ content: 'doctors-mgmt-drawer' }}
    >
      <Stack gap='lg'>
        <Text size='sm' c='dimmed'>
          Refine the directory by specialty, country, and login access.
        </Text>

        <Select
          label='Specialty'
          placeholder='All specialties'
          clearable
          searchable
          data={specialtyOptions}
          value={filters.specialty}
          onChange={(value) => onChange({ ...filters, specialty: value })}
        />

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

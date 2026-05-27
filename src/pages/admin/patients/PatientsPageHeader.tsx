import { memo } from 'react';
import { Button, Group, Stack, Text, Title } from '@mantine/core';
import { IconDownload, IconFilter, IconPlus } from '@tabler/icons-react';

type PatientsPageHeaderProps = {
  totalCount: number;
  canEdit: boolean;
  onOpenFilters: () => void;
  onExport: () => void;
  onAddPatient: () => void;
};

function PatientsPageHeader({
  totalCount,
  canEdit,
  onOpenFilters,
  onExport,
  onAddPatient
}: PatientsPageHeaderProps) {
  return (
    <header className='doctors-mgmt-header'>
      <Stack gap={4} className='doctors-mgmt-header__copy'>
        <Title order={1} className='doctors-mgmt-header__title'>
          Patients
        </Title>
        <Text size='sm' c='dimmed' className='doctors-mgmt-header__subtitle'>
          {totalCount.toLocaleString()} {totalCount === 1 ? 'patient' : 'patients'} in directory
        </Text>
      </Stack>

      <Group gap='sm' className='doctors-mgmt-header__actions' wrap='wrap'>
        <Button
          variant='default'
          radius='md'
          className='doctors-mgmt-header__ghost'
          leftSection={<IconFilter size={18} />}
          onClick={onOpenFilters}
        >
          Filters
        </Button>

        <Button
          variant='default'
          radius='md'
          className='doctors-mgmt-header__ghost'
          leftSection={<IconDownload size={18} />}
          onClick={onExport}
        >
          Export
        </Button>

        {canEdit ? (
          <Button
            radius='md'
            className='doctors-mgmt-header__primary'
            leftSection={<IconPlus size={18} />}
            onClick={onAddPatient}
          >
            Add Patient
          </Button>
        ) : null}
      </Group>
    </header>
  );
}

export default memo(PatientsPageHeader);

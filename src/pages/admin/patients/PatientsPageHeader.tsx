import { memo } from 'react';
import { ActionIcon, Button, Group, Menu, Stack, Text, Title } from '@mantine/core';
import {
  IconDownload,
  IconFilter,
  IconPlus,
  IconRefresh,
  IconSettings
} from '@tabler/icons-react';

type PatientsPageHeaderProps = {
  totalCount: number;
  canAddPatient: boolean;
  onOpenFilters: () => void;
  onExport: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
  onAddPatient: () => void;
};

function PatientsPageHeader({
  totalCount,
  canAddPatient,
  onOpenFilters,
  onExport,
  onRefresh,
  refreshing,
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
        <Menu position='bottom-end' withinPortal shadow='md' radius='md'>
          <Menu.Target>
            <ActionIcon
              variant='default'
              radius='md'
              size='input-md'
              className='doctors-mgmt-header__ghost'
              aria-label='Page settings'
            >
              <IconSettings size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconFilter size={16} />} onClick={onOpenFilters}>
              Filters
            </Menu.Item>
            <Menu.Item leftSection={<IconDownload size={16} />} onClick={onExport}>
              Export
            </Menu.Item>
            <Menu.Item
              leftSection={<IconRefresh size={16} />}
              onClick={onRefresh}
              disabled={refreshing}
            >
              Refresh
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>

        {canAddPatient ? (
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

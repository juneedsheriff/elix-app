import { memo } from 'react';
import { ActionIcon, Button, Group, Menu, Stack, Text, Title } from '@mantine/core';
import {
  IconDownload,
  IconFilter,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSettings
} from '@tabler/icons-react';

type DoctorsPageHeaderProps = {
  totalCount: number;
  canEdit: boolean;
  canRequestPlatformDoctor?: boolean;
  onOpenFilters: () => void;
  onExport: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
  onAddDoctor: () => void;
  onRequestPlatformDoctor?: () => void;
};

function DoctorsPageHeader({
  totalCount,
  canEdit,
  canRequestPlatformDoctor,
  onOpenFilters,
  onExport,
  onRefresh,
  refreshing,
  onAddDoctor,
  onRequestPlatformDoctor
}: DoctorsPageHeaderProps) {
  return (
    <header className='doctors-mgmt-header'>
      <Stack gap={4} className='doctors-mgmt-header__copy'>
        <Title order={1} className='doctors-mgmt-header__title'>
          Doctors
        </Title>
        <Text size='sm' c='dimmed' className='doctors-mgmt-header__subtitle'>
          {totalCount.toLocaleString()} {totalCount === 1 ? 'doctor' : 'doctors'} in directory
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

        {canRequestPlatformDoctor && onRequestPlatformDoctor ? (
          <Button
            variant='default'
            radius='md'
            className='doctors-mgmt-header__ghost'
            leftSection={<IconSearch size={18} />}
            onClick={onRequestPlatformDoctor}
          >
            Request doctor
          </Button>
        ) : null}

        {canEdit ? (
          <Button
            radius='md'
            className='doctors-mgmt-header__primary'
            leftSection={<IconPlus size={18} />}
            onClick={onAddDoctor}
          >
            Add Doctor
          </Button>
        ) : null}
      </Group>
    </header>
  );
}

export default memo(DoctorsPageHeader);

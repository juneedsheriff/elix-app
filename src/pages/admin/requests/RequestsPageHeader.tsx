import { memo } from 'react';
import { ActionIcon, Button, Group, Menu, Stack, Text, Title } from '@mantine/core';
import {
  IconDownload,
  IconFilter,
  IconHomeHeart,
  IconPlus,
  IconRefresh,
  IconSettings
} from '@tabler/icons-react';

type RequestsPageHeaderProps = {
  title: string;
  subtitle: string;
  onOpenFilters: () => void;
  onExport: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
  canAddRequest?: boolean;
  onAddRequest?: () => void;
  onAddHomeCareRequest?: () => void;
  /** Filters, Export, and Refresh live under a settings menu. */
  useSettingsMenu?: boolean;
};

function RequestsPageHeader({
  title,
  subtitle,
  onOpenFilters,
  onExport,
  onRefresh,
  refreshing,
  canAddRequest,
  onAddRequest,
  onAddHomeCareRequest,
  useSettingsMenu = false
}: RequestsPageHeaderProps) {
  const actionButtons = useSettingsMenu ? (
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
  ) : (
    <>
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

      <Button
        variant='default'
        radius='md'
        className='doctors-mgmt-header__ghost'
        leftSection={<IconRefresh size={18} />}
        onClick={onRefresh}
        loading={refreshing}
      >
        Refresh
      </Button>
    </>
  );

  return (
    <header className='doctors-mgmt-header'>
      <Stack gap={4} className='doctors-mgmt-header__copy'>
        <Title order={1} className='doctors-mgmt-header__title'>
          {title}
        </Title>
        <Text size='sm' c='dimmed' className='doctors-mgmt-header__subtitle'>
          {subtitle}
        </Text>
      </Stack>

      <Group gap='sm' className='doctors-mgmt-header__actions' wrap='wrap'>
        {actionButtons}

        {canAddRequest && onAddHomeCareRequest ? (
          <Button
            variant='light'
            color='teal'
            radius='md'
            leftSection={<IconHomeHeart size={18} />}
            onClick={onAddHomeCareRequest}
          >
            Get Homecare Services
          </Button>
        ) : null}

        {canAddRequest && onAddRequest ? (
          <Button
            radius='md'
            className='doctors-mgmt-header__primary'
            leftSection={<IconPlus size={18} />}
            onClick={onAddRequest}
          >
            Add Consultation Request
          </Button>
        ) : null}
      </Group>
    </header>
  );
}

export default memo(RequestsPageHeader);

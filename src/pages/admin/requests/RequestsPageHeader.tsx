import { memo } from 'react';
import { Button, Group, Stack, Text, Title } from '@mantine/core';
import { IconDownload, IconFilter, IconRefresh } from '@tabler/icons-react';

type RequestsPageHeaderProps = {
  title: string;
  subtitle: string;
  onOpenFilters: () => void;
  onExport: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
};

function RequestsPageHeader({
  title,
  subtitle,
  onOpenFilters,
  onExport,
  onRefresh,
  refreshing
}: RequestsPageHeaderProps) {
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
      </Group>
    </header>
  );
}

export default memo(RequestsPageHeader);

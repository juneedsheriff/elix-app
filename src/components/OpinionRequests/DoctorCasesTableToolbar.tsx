import { memo } from 'react';
import { ActionIcon, Group, Text, TextInput, Tooltip } from '@mantine/core';
import { IconMaximize, IconMinimize, IconSearch } from '@tabler/icons-react';
import { MRT_ShowHideColumnsButton, type MRT_TableInstance } from 'mantine-react-table';
import type { OpinionRequest } from '../../types/opinionRequest';

type DoctorCasesTableToolbarProps = {
  table: MRT_TableInstance<OpinionRequest>;
  fullScreen: boolean;
  onToggleFullScreen: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  totalCount: number;
};

function DoctorCasesTableToolbar({
  table,
  fullScreen,
  onToggleFullScreen,
  search,
  onSearchChange,
  totalCount
}: DoctorCasesTableToolbarProps) {
  return (
    <div className='doctors-mgmt-table-toolbar__inner doctor-cases-table-toolbar__inner'>
      <TextInput
        className='doctors-mgmt-search'
        placeholder='Search by patient, email, or message…'
        value={search}
        onChange={(event) => onSearchChange(event.currentTarget.value)}
        leftSection={<IconSearch size={18} stroke={1.5} />}
        radius='md'
        size='md'
      />

      <Text size='sm' c='dimmed' className='doctor-cases-table-toolbar__count'>
        {totalCount} case{totalCount === 1 ? '' : 's'}
      </Text>

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

export default memo(DoctorCasesTableToolbar);

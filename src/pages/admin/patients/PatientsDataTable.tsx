import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
  type MRT_TableInstance
} from 'mantine-react-table';
import type { Patient } from '../../../types/patient';
import {
  adminMgmtTableColumnPinning,
  adminMgmtTablePinningOptions
} from '../components/adminMgmtTablePinning';
import PatientsEmptyState from './PatientsEmptyState';

export type PatientsTableToolbarRenderProps = {
  table: MRT_TableInstance<Patient>;
  fullScreen: boolean;
  onToggleFullScreen: () => void;
};

type PatientsDataTableProps = {
  data: Patient[];
  columns: MRT_ColumnDef<Patient>[];
  isLoading: boolean;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  renderToolbar: (props: PatientsTableToolbarRenderProps) => ReactNode;
};

function PatientsDataTable({
  data,
  columns,
  isLoading,
  hasActiveFilters,
  onClearFilters,
  renderToolbar
}: PatientsDataTableProps) {
  const [fullScreen, setFullScreen] = useState(false);

  useEffect(() => {
    if (!fullScreen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFullScreen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('doctors-mgmt-table-fullscreen-open');

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('doctors-mgmt-table-fullscreen-open');
    };
  }, [fullScreen]);

  const columnPinning = useMemo(() => ({ ...adminMgmtTableColumnPinning }), []);

  const table = useMantineReactTable({
    columns,
    data,
    state: { isLoading, columnPinning },
    ...adminMgmtTablePinningOptions,
    layoutMode: 'grid-no-grow',
    enableColumnActions: true,
    enableColumnFilters: true,
    enableColumnFilterModes: false,
    enableSorting: true,
    enableFilters: true,
    enableGlobalFilter: false,
    enableHiding: true,
    enableDensityToggle: false,
    enableFullScreenToggle: false,
    enablePagination: true,
    enableStickyHeader: true,
    enableBottomToolbar: true,
    enableTopToolbar: false,
    enableHeaderActionsHoverReveal: false,
    columnFilterDisplayMode: 'popover',
    paginationDisplayMode: 'pages',
    positionPagination: 'bottom',
    initialState: {
      density: 'comfortable',
      pagination: { pageSize: 25, pageIndex: 0 },
      columnPinning: adminMgmtTableColumnPinning
    },
    mantinePaperProps: {
      shadow: 'none',
      radius: 0,
      withBorder: false,
      className: 'doctors-mgmt-mrt-paper elixhealth-mrt-paper',
      style: { height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }
    },
    mantineTableContainerProps: {
      className: 'doctors-mgmt-mrt-container elixhealth-mrt-container',
      style: { flex: 1, minHeight: 0, overflow: 'auto' }
    },
    mantineTableProps: {
      highlightOnHover: true,
      striped: true,
      withTableBorder: false,
      withColumnBorders: false,
      className: 'doctors-mgmt-table'
    },
    mantineTableHeadCellProps: {
      className: 'doctors-mgmt-th elixhealth-mrt-head-cell'
    },
    mantineTableBodyCellProps: ({ row }) => ({
      className: `doctors-mgmt-td elixhealth-mrt-body-cell${row.index % 2 === 1 ? ' doctors-mgmt-td--alt' : ''}`
    }),
    mantineTableBodyRowProps: {
      className: 'doctors-mgmt-tr elixhealth-mrt-body-row'
    },
    mantineBottomToolbarProps: {
      className: 'doctors-mgmt-mrt-footer elixhealth-mrt-bottom-toolbar'
    },
    mantinePaginationProps: {
      withEdges: true,
      radius: 'xl',
      color: 'cyan',
      size: 'sm',
      rowsPerPageOptions: ['10', '25', '50', '100'],
      showRowsPerPage: true
    },
    localization: {
      noRecordsToDisplay: 'No records found',
      rowsPerPage: 'Rows per page'
    },
    renderEmptyRowsFallback: () => (
      <PatientsEmptyState hasFilters={hasActiveFilters} onClearFilters={onClearFilters} />
    )
  });

  const toggleFullScreen = () => setFullScreen((open) => !open);

  return (
    <div
      className={
        fullScreen
          ? 'doctors-mgmt-table-shell doctors-mgmt-table-shell--fullscreen'
          : 'doctors-mgmt-table-shell'
      }
    >
      <div className='doctors-mgmt-table-toolbar'>
        {renderToolbar({ table, fullScreen, onToggleFullScreen: toggleFullScreen })}
      </div>
      <MantineReactTable table={table} />
    </div>
  );
}

export default memo(PatientsDataTable);

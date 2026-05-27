import { Text } from '@mantine/core';
import {
  MantineReactTable,
  MRT_GlobalFilterTextInput,
  MRT_ShowHideColumnsButton,
  useMantineReactTable,
  type MRT_ColumnDef,
  type MRT_RowData,
  type MRT_TableOptions
} from 'mantine-react-table';

export type AdminDataTableProps<TData extends MRT_RowData> = {
  title: string;
  subtitle?: string;
  columns: MRT_ColumnDef<TData>[];
  data: TData[];
  isLoading?: boolean;
  searchPlaceholder?: string;
  tableOptions?: Partial<MRT_TableOptions<TData>>;
};

export default function AdminDataTable<TData extends MRT_RowData>({
  title,
  subtitle,
  columns,
  data,
  isLoading = false,
  searchPlaceholder = 'Search…',
  tableOptions
}: AdminDataTableProps<TData>) {
  const table = useMantineReactTable({
    columns,
    data,
    ...tableOptions,
    state: {
      isLoading,
      ...(tableOptions?.state ?? {})
    },
    layoutMode: 'grid-no-grow',
    enableColumnPinning: false,
    enableColumnActions: true,
    enableColumnFilters: true,
    enableColumnFilterModes: false,
    enableSorting: true,
    enableFilters: true,
    enableGlobalFilter: true,
    enableHiding: true,
    enableDensityToggle: false,
    enableFullScreenToggle: false,
    enablePagination: true,
    enableStickyHeader: true,
    enableBottomToolbar: true,
    enableTopToolbar: true,
    enableToolbarInternalActions: false,
    enableHeaderActionsHoverReveal: false,
    columnFilterDisplayMode: 'popover',
    paginationDisplayMode: 'pages',
    positionGlobalFilter: 'right',
    positionPagination: 'bottom',
    initialState: {
      density: 'comfortable',
      pagination: { pageSize: 25, pageIndex: 0 },
      showGlobalFilter: true,
      ...(tableOptions?.initialState ?? {})
    },
    mantinePaperProps: {
      shadow: 'none',
      radius: 'md',
      withBorder: false,
      className: 'elixhealth-mrt-paper',
      style: { height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 },
      ...(tableOptions?.mantinePaperProps ?? {})
    },
    mantineTableContainerProps: {
      className: 'elixhealth-mrt-container',
      style: { flex: 1, minHeight: 0, overflow: 'auto' },
      ...(tableOptions?.mantineTableContainerProps ?? {})
    },
    mantineSearchTextInputProps: {
      placeholder: searchPlaceholder,
      variant: 'default',
      size: 'sm',
      className: 'elixhealth-mrt-search',
      leftSection: undefined,
      ...(tableOptions?.mantineSearchTextInputProps ?? {})
    },
    mantineTableProps: {
      highlightOnHover: true,
      striped: false,
      withTableBorder: false,
      withColumnBorders: false,
      ...(tableOptions?.mantineTableProps ?? {})
    },
    mantineTableHeadCellProps: {
      className: 'elixhealth-mrt-head-cell',
      ...(tableOptions?.mantineTableHeadCellProps ?? {})
    },
    mantineTableBodyCellProps: {
      className: 'elixhealth-mrt-body-cell',
      ...(tableOptions?.mantineTableBodyCellProps ?? {})
    },
    mantineTableBodyRowProps: {
      className: 'elixhealth-mrt-body-row',
      ...(tableOptions?.mantineTableBodyRowProps ?? {})
    },
    mantineBottomToolbarProps: {
      className: 'elixhealth-mrt-bottom-toolbar',
      ...(tableOptions?.mantineBottomToolbarProps ?? {})
    },
    mantinePaginationProps: {
      withEdges: true,
      radius: 'xl',
      color: 'cyan',
      size: 'sm',
      rowsPerPageOptions: ['10', '25', '50', '100'],
      showRowsPerPage: true,
      ...(tableOptions?.mantinePaginationProps ?? {})
    },
    localization: {
      noRecordsToDisplay: 'No records found',
      search: 'Search',
      rowsPerPage: 'Rows per page',
      ...(tableOptions?.localization ?? {})
    },
    renderTopToolbar: ({ table: tbl }) => (
      <div className='elixhealth-datatable-toolbar'>
        <div className='elixhealth-datatable-toolbar__title'>
          <h3 className='elixhealth-datatable-toolbar__heading'>{title}</h3>
          {subtitle ? (
            <Text component='span' className='elixhealth-datatable-toolbar__subtitle' size='sm' c='dimmed'>
              {subtitle}
            </Text>
          ) : null}
        </div>
        <div className='elixhealth-datatable-toolbar__actions'>
          <MRT_GlobalFilterTextInput table={tbl} />
          <MRT_ShowHideColumnsButton table={tbl} />
        </div>
      </div>
    )
  });

  return <MantineReactTable table={table} />;
}

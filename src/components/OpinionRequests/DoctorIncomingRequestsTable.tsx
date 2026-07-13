import { memo, useCallback, useEffect, useState } from 'react';
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_TableInstance
} from 'mantine-react-table';
import { Button, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconClipboardList, IconFilterOff } from '@tabler/icons-react';
import type { OpinionRequest } from '../../types/opinionRequest';
import DoctorCaseDetailsModal from './DoctorCaseDetailsModal';
import DoctorConsultationNotesModal from './DoctorConsultationNotesModal';
import DoctorCasesTableToolbar from './DoctorCasesTableToolbar';
import { useDoctorCasesTableColumns } from './doctorCasesTableColumns';
import '../../pages/admin/doctors/doctors-management.css';
import './doctor-incoming-requests-table.css';

export type DoctorCasesTableToolbarRenderProps = {
  table: MRT_TableInstance<OpinionRequest>;
  fullScreen: boolean;
  onToggleFullScreen: () => void;
};

type DoctorIncomingRequestsTableProps = {
  data: OpinionRequest[];
  isLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onNavigate?: (screenId: string) => void;
  returnScreen?: string;
  onOpenError?: (message: string) => void;
  onRequestUpdated: (request: OpinionRequest) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
};

function DoctorCasesEmptyState({
  hasFilters,
  onClearFilters
}: {
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <Stack className='doctors-mgmt-empty' align='center' justify='center' gap='md' py={64}>
      <ThemeIcon size={72} radius='xl' variant='light' color='cyan' className='doctors-mgmt-empty__icon'>
        {hasFilters ? <IconFilterOff size={36} stroke={1.5} /> : <IconClipboardList size={36} stroke={1.5} />}
      </ThemeIcon>
      <Stack gap={6} align='center' maw={420}>
        <Title order={4} fw={600}>
          {hasFilters ? 'No cases match your search' : 'No incoming requests yet'}
        </Title>
        <Text size='sm' c='dimmed' ta='center'>
          {hasFilters
            ? 'Try adjusting your search terms to find the case you need.'
            : 'Patients can send cases from a doctor profile → Get opinion.'}
        </Text>
      </Stack>
      {hasFilters ? (
        <Button
          variant='light'
          color='cyan'
          radius='md'
          onClick={onClearFilters}
          leftSection={<IconFilterOff size={16} />}
        >
          Clear search
        </Button>
      ) : null}
    </Stack>
  );
}

function DoctorIncomingRequestsTable({
  data,
  isLoading,
  search,
  onSearchChange,
  hasActiveFilters,
  onClearFilters,
  onNavigate,
  returnScreen,
  onOpenError,
  onRequestUpdated,
  onRefresh,
  refreshing = false
}: DoctorIncomingRequestsTableProps) {
  const [fullScreen, setFullScreen] = useState(false);
  const [caseDetailsRequest, setCaseDetailsRequest] = useState<OpinionRequest | null>(null);
  const [consultationNotesRequest, setConsultationNotesRequest] = useState<OpinionRequest | null>(null);
  const columns = useDoctorCasesTableColumns({
    onNavigate,
    returnScreen,
    onViewCaseDetails: setCaseDetailsRequest,
    onViewConsultationNotes: setConsultationNotesRequest
  });

  useEffect(() => {
    if (!caseDetailsRequest) return;
    const updated = data.find((request) => request.id === caseDetailsRequest.id);
    if (updated) setCaseDetailsRequest(updated);
  }, [data, caseDetailsRequest?.id]);

  useEffect(() => {
    if (!consultationNotesRequest) return;
    const updated = data.find((request) => request.id === consultationNotesRequest.id);
    if (updated) setConsultationNotesRequest(updated);
  }, [data, consultationNotesRequest?.id]);

  const handleCaseDetailsUpdated = useCallback(
    (updated: OpinionRequest) => {
      setCaseDetailsRequest(updated);
      onRequestUpdated(updated);
    },
    [onRequestUpdated]
  );

  const handleConsultationNotesUpdated = useCallback(
    (updated: OpinionRequest) => {
      setConsultationNotesRequest(updated);
      onRequestUpdated(updated);
    },
    [onRequestUpdated]
  );

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

  const table = useMantineReactTable({
    columns,
    data,
    state: { isLoading },
    layoutMode: 'grid-no-grow',
    enableColumnPinning: false,
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
      pagination: { pageSize: 25, pageIndex: 0 }
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
      <DoctorCasesEmptyState hasFilters={hasActiveFilters} onClearFilters={onClearFilters} />
    )
  });

  const toggleFullScreen = () => setFullScreen((open) => !open);

  return (
    <>
      <div
        className={
          fullScreen
            ? 'doctors-mgmt-table-shell doctors-mgmt-table-shell--fullscreen doctor-cases-table-shell'
            : 'doctors-mgmt-table-shell doctor-cases-table-shell'
        }
      >
        <div className='doctors-mgmt-table-toolbar'>
          <DoctorCasesTableToolbar
            table={table}
            fullScreen={fullScreen}
            onToggleFullScreen={toggleFullScreen}
            search={search}
            onSearchChange={onSearchChange}
            totalCount={data.length}
            onRefresh={onRefresh}
            refreshing={refreshing}
          />
        </div>
        <MantineReactTable table={table} />
      </div>
      <DoctorCaseDetailsModal
        open={Boolean(caseDetailsRequest)}
        request={caseDetailsRequest}
        onClose={() => setCaseDetailsRequest(null)}
        onOpenError={onOpenError}
        onNavigate={onNavigate}
        returnScreen={returnScreen}
        onRequestUpdated={handleCaseDetailsUpdated}
      />
      <DoctorConsultationNotesModal
        open={Boolean(consultationNotesRequest)}
        request={consultationNotesRequest}
        onClose={() => setConsultationNotesRequest(null)}
        onRequestUpdated={handleConsultationNotesUpdated}
      />
    </>
  );
}

export default memo(DoctorIncomingRequestsTable);

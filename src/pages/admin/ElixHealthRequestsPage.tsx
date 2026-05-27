import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from '@mantine/core';
import { fetchPatientServiceExecutives } from '../../lib/admins';
import {
  assignOpinionRequest,
  fetchOpinionRequestsForStaff,
  forwardOpinionRequestToDoctor,
  staffRequestStatusLabel
} from '../../lib/opinionRequests';
import { getMedicalRecordDownloadUrl } from '../../lib/records';
import { isAdministrator, isPatientServiceExecutive } from '../../lib/staffPermissions';
import type { Admin } from '../../types/admin';
import type { OpinionRequest } from '../../types/opinionRequest';
import { useElixHealthStaff } from './ElixHealthStaffContext';
import RequestDetailDrawer from './requests/RequestDetailDrawer';
import RequestsAnalyticsCards from './requests/RequestsAnalyticsCards';
import RequestsDataTable from './requests/RequestsDataTable';
import RequestsFilterDrawer from './requests/RequestsFilterDrawer';
import RequestsPageHeader from './requests/RequestsPageHeader';
import RequestsPageSkeleton from './requests/RequestsPageSkeleton';
import RequestsTableToolbar from './requests/RequestsTableToolbar';
import {
  applyRequestQuickFilters,
  computeRequestAnalytics,
  exportRequestsCsv,
  uniqueSorted,
  type RequestQuickFilters
} from './requests/requestsUtils';
import { useRequestsTableColumns } from './requests/requestsTableColumns';
import './doctors/doctors-management.css';

const DEFAULT_FILTERS: RequestQuickFilters = {
  queue: 'pending',
  status: 'all',
  specialty: null,
  assignee: null
};

function matchesSearch(request: OpinionRequest, query: string) {
  const haystack = [
    request.patient_name,
    request.patient_email,
    request.doctor_name,
    request.doctor_specialty,
    request.message,
    request.assigned_to_name,
    staffRequestStatusLabel(request)
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

export default function ElixHealthRequestsPage() {
  const staff = useElixHealthStaff();
  const isAdmin = isAdministrator(staff);
  const isPse = isPatientServiceExecutive(staff);

  const [requests, setRequests] = useState<OpinionRequest[]>([]);
  const [executives, setExecutives] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<RequestQuickFilters>(DEFAULT_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<OpinionRequest | null>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [coordinationNotes, setCoordinationNotes] = useState('');

  const load = useCallback(async () => {
    setError(null);

    const [requestsRes, executivesRes] = await Promise.all([
      fetchOpinionRequestsForStaff(),
      isAdmin ? fetchPatientServiceExecutives() : Promise.resolve({ data: [] as Admin[], error: null })
    ]);

    if (requestsRes.error) {
      setError(requestsRes.error.message);
      setRequests([]);
    } else {
      setRequests(requestsRes.data ?? []);
    }

    if (executivesRes.error && isAdmin) {
      setError(executivesRes.error.message);
    } else if (isAdmin) {
      setExecutives(executivesRes.data ?? []);
    }
  }, [isAdmin]);

  const initialLoad = useCallback(async () => {
    setLoading(true);
    await load();
    setLoading(false);
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    void initialLoad();
  }, [initialLoad]);

  const analytics = useMemo(
    () => computeRequestAnalytics(requests, isAdmin),
    [requests, isAdmin]
  );

  const specialtyOptions = useMemo(
    () => uniqueSorted(requests.map((request) => request.doctor_specialty)),
    [requests]
  );

  const assigneeOptions = useMemo(
    () => uniqueSorted(requests.map((request) => request.assigned_to_name)),
    [requests]
  );

  const normalizedSearch = search.trim().toLowerCase();

  const filteredRequests = useMemo(() => {
    let list = applyRequestQuickFilters(requests, filters, isAdmin);
    if (normalizedSearch) {
      list = list.filter((request) => matchesSearch(request, normalizedSearch));
    }
    return list;
  }, [requests, filters, isAdmin, normalizedSearch]);

  const hasActiveFilters =
    Boolean(normalizedSearch) ||
    filters.queue !== 'pending' ||
    filters.status !== 'all' ||
    Boolean(filters.specialty) ||
    Boolean(filters.assignee);

  const clearFilters = useCallback(() => {
    setSearch('');
    setFilters(DEFAULT_FILTERS);
  }, []);

  const handleExport = useCallback(() => {
    exportRequestsCsv(filteredRequests);
  }, [filteredRequests]);

  const openRequest = useCallback((request: OpinionRequest) => {
    setSelectedRequest(request);
    setAssigneeId('');
    setCoordinationNotes('');
    setActionMessage(null);
    setSuccessMessage(null);
    setDrawerOpen(true);
  }, []);

  const columns = useRequestsTableColumns({
    isAdmin,
    onView: openRequest
  });

  const openRecord = async (storagePath: string) => {
    const { data, error: urlError } = await getMedicalRecordDownloadUrl(storagePath);
    if (urlError || !data?.signedUrl) {
      setActionMessage(urlError?.message ?? 'Could not open file.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleAssign = async () => {
    if (!selectedRequest) return;
    if (!assigneeId) {
      setActionMessage('Select a Patient Service Executive before assigning.');
      return;
    }

    setBusyId(selectedRequest.id);
    setActionMessage(null);
    setSuccessMessage(null);

    const { error: assignError } = await assignOpinionRequest(selectedRequest.id, assigneeId);
    setBusyId(null);

    if (assignError) {
      setActionMessage(assignError.message);
      return;
    }

    const executive = executives.find((e) => e.id === assigneeId);
    setSuccessMessage(
      `Assigned request from ${selectedRequest.patient_name ?? 'patient'} to ${executive?.full_name ?? 'Patient Service Executive'}.`
    );
    setDrawerOpen(false);
    void refresh();
  };

  const handleForward = async () => {
    if (!selectedRequest) return;

    setBusyId(selectedRequest.id);
    setActionMessage(null);
    setSuccessMessage(null);

    const { error: forwardError } = await forwardOpinionRequestToDoctor(
      selectedRequest.id,
      coordinationNotes
    );
    setBusyId(null);

    if (forwardError) {
      setActionMessage(forwardError.message);
      return;
    }

    setSuccessMessage(`Sent request to ${selectedRequest.doctor_name ?? 'doctor'} for review.`);
    setDrawerOpen(false);
    void refresh();
  };

  const pageTitle = isPse ? 'My assigned requests' : 'Opinion requests';
  const pageSubtitle = isAdmin
    ? `${analytics.pendingQueue} pending assignment · ${analytics.total} total`
    : `${analytics.pendingQueue} awaiting coordination · ${analytics.total} assigned to you`;
  const pendingCardLabel = isAdmin ? 'Pending Assignment' : 'Awaiting Coordination';

  if (error && !loading && requests.length === 0) {
    return (
      <Alert color='red' radius='md' title='Could not load requests' className='doctors-mgmt'>
        {error}. Ensure migration 017_staff_roles_request_assignment.sql is applied in Supabase.
      </Alert>
    );
  }

  if (loading && requests.length === 0) {
    return <RequestsPageSkeleton />;
  }

  return (
    <div className='doctors-mgmt doctors-mgmt-page elixhealth-datatable-page'>
      <RequestsPageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        onOpenFilters={() => setFilterDrawerOpen(true)}
        onExport={handleExport}
        onRefresh={() => void refresh()}
        refreshing={refreshing}
      />

      {actionMessage ? (
        <Alert color='red' radius='md' onClose={() => setActionMessage(null)} withCloseButton>
          {actionMessage}
        </Alert>
      ) : null}

      {successMessage ? (
        <Alert color='green' radius='md' onClose={() => setSuccessMessage(null)} withCloseButton>
          {successMessage}
        </Alert>
      ) : null}

      <RequestsAnalyticsCards
        analytics={analytics}
        pendingLabel={pendingCardLabel}
        loading={loading}
      />

      <div className='elixhealth-datatable-card doctors-mgmt-table-card'>
        <RequestsDataTable
          data={filteredRequests}
          columns={columns}
          isLoading={loading}
          hasActiveFilters={hasActiveFilters}
          isPendingQueue={filters.queue === 'pending'}
          isAdmin={isAdmin}
          onClearFilters={clearFilters}
          renderToolbar={({ table, fullScreen, onToggleFullScreen }) => (
            <RequestsTableToolbar
              table={table}
              fullScreen={fullScreen}
              onToggleFullScreen={onToggleFullScreen}
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              specialtyOptions={specialtyOptions}
              pendingCount={analytics.pendingQueue}
              totalCount={analytics.total}
              onFilterChange={setFilters}
            />
          )}
        />
      </div>

      <RequestsFilterDrawer
        opened={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        filters={filters}
        specialtyOptions={specialtyOptions}
        assigneeOptions={assigneeOptions}
        showAssignee={isAdmin}
        onChange={setFilters}
        onReset={clearFilters}
      />

      <RequestDetailDrawer
        request={selectedRequest}
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        isAdmin={isAdmin}
        isPse={isPse}
        executives={executives}
        assigneeId={assigneeId}
        onAssigneeChange={setAssigneeId}
        coordinationNotes={coordinationNotes}
        onCoordinationNotesChange={setCoordinationNotes}
        busy={busyId === selectedRequest?.id}
        onAssign={() => void handleAssign()}
        onForward={() => void handleForward()}
        onOpenRecord={(path) => void openRecord(path)}
      />
    </div>
  );
}

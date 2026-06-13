import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@mantine/core';
import { fetchAllDoctorsForAdmin, fetchPatientServiceExecutives } from '../../lib/admins';
import {
  assignOpinionRequest,
  deleteOpinionRequestForAdmin,
  fetchOpinionRequestsForStaff,
  staffRequestStatusLabel,
  subscribeStaffOpinionRequestUpdates
} from '../../lib/opinionRequests';
import { getMedicalRecordDownloadUrl } from '../../lib/records';
import { isAdministrator, isPatientServiceExecutive } from '../../lib/staffPermissions';
import type { Admin } from '../../types/admin';
import type { Doctor } from '../../types/doctor';
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
  getDefaultRequestFilters,
  uniqueSorted,
  type RequestQuickFilters
} from './requests/requestsUtils';
import { useRequestsTableColumns } from './requests/requestsTableColumns';
import './doctors/doctors-management.css';

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
  const [filters, setFilters] = useState<RequestQuickFilters>(() => getDefaultRequestFilters(isAdmin));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<OpinionRequest | null>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const assigneeDraftRef = useRef<Map<string, string>>(new Map());
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const stageSnapshotRef = useRef<Map<string, string | null>>(new Map());

  const notifyPatientSelectionIfNew = useCallback(
    (next: OpinionRequest[]) => {
      for (const request of next) {
        const prev = stageSnapshotRef.current.get(request.id);
        const stage = request.consultation_stage ?? null;
        if (
          prev !== 'availability_submitted' &&
          stage === 'availability_submitted' &&
          (isPse ? request.assigned_to === staff.id : true)
        ) {
          setSuccessMessage(
            `${request.patient_name ?? 'Patient'} selected ${request.doctor_name ?? 'a doctor'} with a preferred time. Open Step 3 — Recommend doctors to review availability.`
          );
        }
        stageSnapshotRef.current.set(request.id, stage);
      }
    },
    [isPse, staff.id]
  );

  const load = useCallback(async () => {
    setError(null);

    const [requestsRes, executivesRes, doctorsRes] = await Promise.all([
      fetchOpinionRequestsForStaff(),
      isAdmin ? fetchPatientServiceExecutives() : Promise.resolve({ data: [] as Admin[], error: null }),
      isAdmin || isPse
        ? fetchAllDoctorsForAdmin()
        : Promise.resolve({ data: [] as Doctor[], error: null })
    ]);

    if (requestsRes.error) {
      setError(requestsRes.error.message);
      setRequests([]);
    } else {
      const next = requestsRes.data ?? [];
      notifyPatientSelectionIfNew(next);
      setRequests(next);
    }

    if (executivesRes.error && isAdmin) {
      setError(executivesRes.error.message);
    } else if (isAdmin) {
      setExecutives(executivesRes.data ?? []);
    }

    if (doctorsRes.error && (isAdmin || isPse)) {
      setError(doctorsRes.error.message);
    } else if (isAdmin || isPse) {
      setDoctors(doctorsRes.data ?? []);
    }
  }, [isAdmin, isPse, notifyPatientSelectionIfNew]);

  const initialLoad = useCallback(async () => {
    setLoading(true);
    await load();
    setLoading(false);
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const requestsRes = await fetchOpinionRequestsForStaff();
    if (requestsRes.error) {
      setError(requestsRes.error.message);
    } else {
      const next = requestsRes.data ?? [];
      notifyPatientSelectionIfNew(next);
      setRequests(next);
      setSelectedRequest((current) => {
        if (!current) return null;
        const updated = next.find((request) => request.id === current.id);
        if (!updated) return null;
        const merged = {
          ...current,
          ...updated,
          assigned_to: updated.assigned_to ?? current.assigned_to,
          assigned_to_name: updated.assigned_to_name ?? current.assigned_to_name,
          assigned_at: updated.assigned_at ?? current.assigned_at,
          consultation_stage: updated.consultation_stage ?? current.consultation_stage,
          schedule_confirmed_at: updated.schedule_confirmed_at ?? current.schedule_confirmed_at,
          payment_link: updated.payment_link ?? current.payment_link,
          payment_status: updated.payment_status ?? current.payment_status,
          payment_proof_submitted_at:
            updated.payment_proof_submitted_at ?? current.payment_proof_submitted_at,
          payment_proof_storage_path:
            updated.payment_proof_storage_path ?? current.payment_proof_storage_path,
          invoice_pdf_storage_path:
            updated.invoice_pdf_storage_path ?? current.invoice_pdf_storage_path,
          invoice_generated_at: updated.invoice_generated_at ?? current.invoice_generated_at,
          invoice_number: updated.invoice_number ?? current.invoice_number,
          invoice_subtotal: updated.invoice_subtotal ?? current.invoice_subtotal,
          invoice_tax_rate: updated.invoice_tax_rate ?? current.invoice_tax_rate,
          invoice_tax_amount: updated.invoice_tax_amount ?? current.invoice_tax_amount,
          invoice_total: updated.invoice_total ?? current.invoice_total,
          records: updated.records.length ? updated.records : current.records
        };
        if (merged.assigned_to) {
          setAssigneeId(merged.assigned_to);
        }
        return merged;
      });
    }
    setRefreshing(false);
  }, [notifyPatientSelectionIfNew]);

  useEffect(() => {
    void initialLoad();
  }, [initialLoad]);

  useEffect(() => {
    if (!isAdmin && !isPse) return;
    return subscribeStaffOpinionRequestUpdates(() => void refresh(), {
      assignedToAdminId: isPse ? staff.id : null
    });
  }, [refresh, isAdmin, isPse, staff.id]);

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

  const defaultFilters = useMemo(() => getDefaultRequestFilters(isAdmin), [isAdmin]);

  const hasActiveFilters =
    Boolean(normalizedSearch) ||
    filters.queue !== defaultFilters.queue ||
    filters.status !== 'all' ||
    Boolean(filters.specialty) ||
    Boolean(filters.assignee);

  const clearFilters = useCallback(() => {
    setSearch('');
    setFilters(getDefaultRequestFilters(isAdmin));
  }, [isAdmin]);

  const handleExport = useCallback(() => {
    exportRequestsCsv(filteredRequests);
  }, [filteredRequests]);

  useEffect(() => {
    if (!drawerOpen || !selectedRequest?.assigned_to) return;
    setAssigneeId(selectedRequest.assigned_to);
  }, [drawerOpen, selectedRequest?.id, selectedRequest?.assigned_to]);

  const handleAssigneeChange = useCallback(
    (value: string) => {
      setAssigneeId(value);
      if (selectedRequest && !selectedRequest.assigned_to && value) {
        assigneeDraftRef.current.set(selectedRequest.id, value);
      }
    },
    [selectedRequest]
  );

  const openRequest = useCallback((request: OpinionRequest) => {
    setSelectedRequest(request);
    const draft = assigneeDraftRef.current.get(request.id);
    setAssigneeId(request.assigned_to ?? draft ?? '');
    setActionMessage(null);
    setSuccessMessage(null);
    setDrawerOpen(true);
  }, []);

  const handleDeleteRequest = useCallback(
    async (request: OpinionRequest) => {
      const label = request.patient_name ?? 'this patient';
      if (
        !window.confirm(
          `Delete the opinion request for ${label} with ${request.doctor_name ?? 'the doctor'}? This removes it for the patient, PSE, and doctor.`
        )
      ) {
        return;
      }

      setBusyId(request.id);
      setActionMessage(null);
      setSuccessMessage(null);

      const { error: deleteError } = await deleteOpinionRequestForAdmin(request.id);
      setBusyId(null);

      if (deleteError) {
        setActionMessage(deleteError.message);
        return;
      }

      if (selectedRequest?.id === request.id) {
        setDrawerOpen(false);
        setSelectedRequest(null);
      }

      setSuccessMessage(`Deleted request for ${label}.`);
      void refresh();
    },
    [refresh, selectedRequest?.id]
  );

  const columns = useRequestsTableColumns({
    isAdmin,
    onView: openRequest,
    onDelete: isAdmin ? (request) => void handleDeleteRequest(request) : undefined
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
    const assignedAt = new Date().toISOString();
    const executiveName = executive?.full_name ?? 'Patient Service Executive';

    setSelectedRequest({
      ...selectedRequest,
      assigned_to: assigneeId,
      assigned_to_name: executiveName,
      assigned_at: assignedAt,
      consultation_stage: 'assigned'
    });
    setAssigneeId(assigneeId);
    assigneeDraftRef.current.delete(selectedRequest.id);
    setSuccessMessage(
      `Assigned request from ${selectedRequest.patient_name ?? 'patient'} to ${executiveName}.`
    );
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
        {error}. Run <code>npm run db:apply-staff-roles</code> and{' '}
        <code>npm run db:apply-consultation-workflow</code>, or apply{' '}
        <code>supabase/migrations/019_consultation_workflow.sql</code> in the Supabase SQL Editor.
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
        showPatientSelections={isPse || isAdmin}
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
        doctors={doctors}
        assigneeId={assigneeId}
        onAssigneeChange={handleAssigneeChange}
        busy={busyId === selectedRequest?.id}
        onAssign={() => void handleAssign()}
        onOpenRecord={(path) => void openRecord(path)}
        onWorkflowUpdated={() => void refresh()}
        onError={setActionMessage}
        onSuccess={setSuccessMessage}
      />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@mantine/core';
import { fetchAllDoctorsForAdmin, fetchAllPatientsForAdmin, fetchPatientServiceExecutives } from '../../lib/admins';
import {
  assignOpinionRequest,
  deleteOpinionRequestForAdmin,
  fetchOpinionRequestsForStaff,
  hasPseCoordinationStarted,
  staffRequestStatusLabel,
  subscribeStaffOpinionRequestUpdates
} from '../../lib/opinionRequests';
import { openMedicalRecordByPath } from '../../lib/records';
import { canCreateRequests, isAdministrator, isAnyPatientServiceExecutive, isClinicPatientServiceExecutive } from '../../lib/staffPermissions';
import type { Admin } from '../../types/admin';
import type { Doctor } from '../../types/doctor';
import type { OpinionRequest } from '../../types/opinionRequest';
import type { Patient } from '../../types/patient';
import { useElixHealthStaff } from './ElixHealthStaffContext';
import WorkspaceTabs from './WorkspaceTabs';
import RequestDetailDrawer from './requests/RequestDetailDrawer';
import RequestsAnalyticsCards from './requests/RequestsAnalyticsCards';
import RequestsDataTable from './requests/RequestsDataTable';
import RequestsFilterDrawer from './requests/RequestsFilterDrawer';
import RequestsPageHeader from './requests/RequestsPageHeader';
import ClinicPseCreateRequestModal from './requests/ClinicPseCreateRequestModal';
import RequestsPageSkeleton from './requests/RequestsPageSkeleton';
import RequestsTableToolbar from './requests/RequestsTableToolbar';
import {
  applyRequestQuickFilters,
  computeRequestAnalytics,
  exportRequestsCsv,
  getDefaultRequestFilters,
  uniqueSorted,
  type RequestQuickFilters,
  type RequestWorkspaceFilter
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
  const { staff } = useElixHealthStaff();
  const isAdmin = isAdministrator(staff);
  const isPse = isAnyPatientServiceExecutive(staff);
  const isClinicPse = isClinicPatientServiceExecutive(staff);
  const canAddRequest = canCreateRequests(staff);

  const [requests, setRequests] = useState<OpinionRequest[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [executives, setExecutives] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<RequestQuickFilters>(() => getDefaultRequestFilters(isAdmin));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addRequestModalOpen, setAddRequestModalOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<OpinionRequest | null>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [coordinationUnlockedId, setCoordinationUnlockedId] = useState<string | null>(null);
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

    const [requestsRes, executivesRes, doctorsRes, patientsRes] = await Promise.all([
      fetchOpinionRequestsForStaff(),
      isAdmin ? fetchPatientServiceExecutives() : isClinicPse ? Promise.resolve({ data: [staff], error: null }) : Promise.resolve({ data: [] as Admin[], error: null }),
      isAdmin || isPse
        ? fetchAllDoctorsForAdmin()
        : Promise.resolve({ data: [] as Doctor[], error: null }),
      isClinicPse
        ? fetchAllPatientsForAdmin()
        : Promise.resolve({ data: [] as Patient[], error: null })
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
    } else if (isAdmin || isClinicPse) {
      setExecutives(executivesRes.data ?? []);
    }

    if (doctorsRes.error && (isAdmin || isPse)) {
      setError(doctorsRes.error.message);
    } else if (isAdmin || isPse) {
      setDoctors(doctorsRes.data ?? []);
    }

    if (patientsRes.error && isClinicPse) {
      setError(patientsRes.error.message);
    } else if (isClinicPse) {
      setPatients(patientsRes.data ?? []);
    }
  }, [isAdmin, isClinicPse, isPse, notifyPatientSelectionIfNew, staff]);

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
          consultation_stage:
            hasPseCoordinationStarted(current) && !hasPseCoordinationStarted(updated)
              ? current.consultation_stage ?? updated.consultation_stage
              : updated.consultation_stage ?? current.consultation_stage,
          message: updated.message ?? current.message,
          requested_specialty: updated.requested_specialty ?? current.requested_specialty,
          patient_case_details: updated.patient_case_details ?? current.patient_case_details,
          case_details_reviewed_at:
            updated.case_details_reviewed_at ?? current.case_details_reviewed_at,
          schedule_confirmed_at: updated.schedule_confirmed_at ?? current.schedule_confirmed_at,
          payment_link: updated.payment_link ?? current.payment_link,
          payment_status: updated.payment_status ?? current.payment_status,
          payment_amount:
            updated.payment_amount != null ? updated.payment_amount : current.payment_amount,
          payment_currency: updated.payment_currency ?? current.payment_currency,
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

  const patchSelectedRequest = useCallback((patch: Partial<OpinionRequest> & { id: string }) => {
    setSelectedRequest((current) =>
      current?.id === patch.id ? ({ ...current, ...patch } as OpinionRequest) : current
    );
    setRequests((prev) =>
      prev.map((request) =>
        request.id === patch.id ? ({ ...request, ...patch } as OpinionRequest) : request
      )
    );
  }, []);

  useEffect(() => {
    void initialLoad();
  }, [initialLoad]);

  useEffect(() => {
    if (!isAdmin && !isPse) return;
    return subscribeStaffOpinionRequestUpdates(() => void refresh(), {
      assignedToAdminId: isPse ? staff.id : null
    });
  }, [refresh, isAdmin, isPse, staff.id]);

  const workspaceScopedRequests = useMemo(
    () =>
      applyRequestQuickFilters(
        requests,
        {
          queue: 'all',
          status: 'all',
          workspace: filters.workspace,
          specialty: null,
          assignee: null
        },
        isAdmin
      ),
    [filters.workspace, isAdmin, requests]
  );

  const analytics = useMemo(
    () => computeRequestAnalytics(workspaceScopedRequests, isAdmin),
    [workspaceScopedRequests, isAdmin]
  );

  const specialtyOptions = useMemo(
    () => uniqueSorted(requests.map((request) => request.doctor_specialty)),
    [requests]
  );

  const assigneeOptions = useMemo(
    () => uniqueSorted(requests.map((request) => request.assigned_to_name)),
    [requests]
  );

  const workspaceOptions = useMemo(() => {
    if (!isAdmin) return [] as Array<{ value: RequestWorkspaceFilter; label: string }>;
    const clinics = new Map<string, { name: string; count: number }>();
    let globalCount = 0;

    for (const request of requests) {
      if (!request.clinic_id) {
        globalCount += 1;
        continue;
      }

      const current = clinics.get(request.clinic_id);
      if (current) {
        current.count += 1;
        continue;
      }

      clinics.set(request.clinic_id, {
        name: request.clinic_name?.trim() || 'Clinic workspace',
        count: 1
      });
    }

    const clinicEntries = [...clinics.entries()]
      .map(([id, clinic]) => ({ id, name: clinic.name, count: clinic.count }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const clinicNameCounts = new Map<string, number>();
    for (const entry of clinicEntries) {
      clinicNameCounts.set(entry.name, (clinicNameCounts.get(entry.name) ?? 0) + 1);
    }

    const clinicOptions = clinicEntries.map((entry) => {
      const duplicateName = (clinicNameCounts.get(entry.name) ?? 0) > 1;
      const needsIdHint = duplicateName || entry.name === 'Clinic workspace';
      const idHint = needsIdHint ? ` · ${entry.id.slice(0, 8)}` : '';
      return {
        value: `clinic:${entry.id}` as RequestWorkspaceFilter,
        label: `${entry.name}${idHint} (${entry.count})`
      };
    });

    return [{ value: 'global' as const, label: `Global (${globalCount})` }, ...clinicOptions];
  }, [isAdmin, requests]);

  const workspaceTabs = workspaceOptions;

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
    filters.workspace !== defaultFilters.workspace ||
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

  useEffect(() => {
    if (!drawerOpen || !selectedRequest || !isClinicPse) return;
    if (selectedRequest.assigned_to || selectedRequest.status === 'closed') return;

    let cancelled = false;
    const requestId = selectedRequest.id;

    void (async () => {
      setBusyId(requestId);
      try {
        const { data: assignData, error: assignError } = await assignOpinionRequest(
          requestId,
          staff.id
        );

        if (assignError) {
          if (!cancelled) {
            setActionMessage(assignError.message);
          }
          return;
        }

        const patch = {
          id: requestId,
          assigned_to: assignData?.assigned_to ?? staff.id,
          assigned_to_name: staff.full_name,
          assigned_at: assignData?.assigned_at ?? new Date().toISOString(),
          consultation_stage: assignData?.consultation_stage ?? ('assigned' as const)
        };
        // Always apply a successful claim locally. A concurrent refresh/effect cleanup must not
        // leave the drawer without assigned_to (which shows "Coordination unavailable").
        patchSelectedRequest(patch);
        setSelectedRequest((current) =>
          current?.id === requestId ? ({ ...current, ...patch } as OpinionRequest) : current
        );
        setAssigneeId(staff.id);
        if (!cancelled) {
          void refresh();
        }
      } finally {
        setBusyId((current) => (current === requestId ? null : current));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    drawerOpen,
    selectedRequest?.id,
    selectedRequest?.assigned_to,
    selectedRequest?.status,
    isClinicPse,
    staff.id,
    staff.full_name,
    patchSelectedRequest,
    refresh
  ]);

  const handleAssigneeChange = useCallback(
    (value: string) => {
      setAssigneeId(value);
      if (selectedRequest && value) {
        assigneeDraftRef.current.set(selectedRequest.id, value);
      }
    },
    [selectedRequest]
  );

  const openRequest = useCallback(
    (request: OpinionRequest) => {
      setSelectedRequest(request);
      const draft = assigneeDraftRef.current.get(request.id);
      const defaultAssignee =
        request.assigned_to ??
        draft ??
        (isClinicPse && !request.assigned_to ? staff.id : '');
      setAssigneeId(defaultAssignee);
      setActionMessage(null);
      setSuccessMessage(null);
      setDrawerOpen(true);
    },
    [isClinicPse, staff.id]
  );

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
    const { error } = await openMedicalRecordByPath(storagePath);
    if (error) {
      setActionMessage(error.message);
    }
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

    const { data: assignData, error: assignError } = await assignOpinionRequest(
      selectedRequest.id,
      assigneeId
    );
    setBusyId(null);

    if (assignError) {
      setActionMessage(assignError.message);
      return;
    }

    const executive = executives.find((e) => e.id === assigneeId);
    const assignedAt = assignData?.assigned_at ?? new Date().toISOString();
    const executiveName =
      executive?.full_name ??
      (assigneeId === staff.id ? staff.full_name : null) ??
      'Patient Service Executive';
    const assignedRequest: OpinionRequest = {
      ...selectedRequest,
      assigned_to: assignData?.assigned_to ?? assigneeId,
      assigned_to_name: executiveName,
      assigned_at: assignedAt,
      consultation_stage: assignData?.consultation_stage ?? 'assigned'
    };

    setRequests((prev) =>
      prev.map((request) => (request.id === selectedRequest.id ? assignedRequest : request))
    );
    assigneeDraftRef.current.set(selectedRequest.id, assigneeId);
    setAssigneeId(assigneeId);
    setSelectedRequest(assignedRequest);
    setCoordinationUnlockedId(selectedRequest.id);
    setSuccessMessage(
      isClinicPse && assigneeId === staff.id
        ? `You claimed the request from ${selectedRequest.patient_name ?? 'patient'}. Coordination steps are ready below.`
        : `Assigned request from ${selectedRequest.patient_name ?? 'patient'} to ${executiveName}. You can review coordination steps below.`
    );
  };

  const pageTitle = isPse ? 'My assigned requests' : 'Opinion requests';
  const pageSubtitle = isAdmin
    ? `${analytics.pendingQueue} pending assignment · ${analytics.assignedQueue} assigned · ${analytics.total} total`
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
        canAddRequest={canAddRequest}
        onAddRequest={() => setAddRequestModalOpen(true)}
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

      {isAdmin && workspaceTabs.length ? (
        <WorkspaceTabs
          tabs={workspaceTabs}
          value={filters.workspace}
          onChange={(value) =>
            setFilters((current) => ({
              ...current,
              workspace: value as RequestWorkspaceFilter
            }))
          }
        />
      ) : null}

      <RequestsAnalyticsCards
        analytics={analytics}
        pendingLabel={pendingCardLabel}
        showPatientSelections={isPse}
        showAssigned={isAdmin}
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
              assignedCount={analytics.assignedQueue}
              completedCount={analytics.closed}
              totalCount={analytics.total}
              showAssignedQueue={isAdmin}
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
        workspaceOptions={workspaceOptions}
        assigneeOptions={assigneeOptions}
        showAssignee={isAdmin}
        onChange={setFilters}
        onReset={clearFilters}
      />

      <RequestDetailDrawer
        request={selectedRequest}
        opened={drawerOpen}
        coordinationUnlocked={selectedRequest?.id === coordinationUnlockedId}
        feedbackMessage={actionMessage}
        feedbackSuccess={successMessage}
        onClose={() => {
          if (selectedRequest && assigneeId) {
            assigneeDraftRef.current.set(selectedRequest.id, assigneeId);
          }
          setCoordinationUnlockedId(null);
          setDrawerOpen(false);
        }}
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
        onRequestPatch={patchSelectedRequest}
        onError={setActionMessage}
        onSuccess={setSuccessMessage}
      />

      {canAddRequest ? (
        <ClinicPseCreateRequestModal
          opened={addRequestModalOpen}
          onClose={() => setAddRequestModalOpen(false)}
          staff={staff}
          patients={patients}
          doctors={doctors}
          onCreated={() => {
            setSuccessMessage('Opinion request created and assigned to you.');
            void refresh();
          }}
        />
      ) : null}
    </div>
  );
}

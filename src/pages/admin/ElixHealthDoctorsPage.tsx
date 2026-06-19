import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Group, Modal, Select, Stack, Text } from '@mantine/core';
import { deleteDoctorForAdmin, fetchAllDoctorsForAdmin, fetchPatientServiceExecutives } from '../../lib/admins';
import {
  fetchGrantedDoctorIdsForClinic,
  buildDoctorWorkspaceLinksMap,
  fetchDoctorWorkspaceGrantsForAdmin,
  removeDoctorFromClinicWorkspace,
  subscribeClinicDoctorsUpdates
} from '../../lib/clinicDoctorRequests';
import {
  countPendingOpinionRequestsForDoctorForAdmin,
  reassignPendingOpinionRequestsToPseForAdmin
} from '../../lib/opinionRequests';
import { canCreateDoctors, canEditProfiles, canRequestPlatformDoctors, canReviewClinicDoctorRequests, isAdministrator } from '../../lib/staffPermissions';
import type { Admin } from '../../types/admin';
import type { DoctorWorkspaceLink } from '../../types/clinicDoctorRequest';
import type { Doctor } from '../../types/doctor';
import DoctorsAnalyticsCards from './doctors/DoctorsAnalyticsCards';
import DoctorsDataTable from './doctors/DoctorsDataTable';
import DoctorsFilterDrawer from './doctors/DoctorsFilterDrawer';
import DoctorsPageHeader from './doctors/DoctorsPageHeader';
import DoctorsPageSkeleton from './doctors/DoctorsPageSkeleton';
import DoctorsTableToolbar from './doctors/DoctorsTableToolbar';
import {
  applyDoctorQuickFilters,
  computeDoctorAnalytics,
  exportDoctorsCsv,
  uniqueSorted,
  type DoctorQuickFilters
} from './doctors/doctorsUtils';
import { useDoctorsTableColumns } from './doctors/doctorsTableColumns';
import { useElixHealthStaff } from './ElixHealthStaffContext';
import ClinicDoctorRequestsAdminPanel from './doctors/ClinicDoctorRequestsAdminPanel';
import ClinicPseRequestDoctorModal from './doctors/ClinicPseRequestDoctorModal';
import { ELIX_HEALTH_PATHS } from './elixHealthRoutes';
import './doctors/doctors-management.css';

const DEFAULT_FILTERS: DoctorQuickFilters = {
  specialty: null,
  country: null,
  login: 'all'
};

function matchesSearch(doctor: Doctor, query: string) {
  const haystack = [
    doctor.full_name,
    doctor.email,
    doctor.specialty,
    doctor.clinic_name,
    doctor.hospital,
    doctor.clinic_city,
    doctor.country,
    doctor.clinic_country,
    doctor.mobile_no,
    doctor.phone,
    doctor.gender,
    doctor.qualification
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

export default function ElixHealthDoctorsPage() {
  const navigate = useNavigate();
  const { staff } = useElixHealthStaff();
  const isAdmin = isAdministrator(staff);
  const canEdit = canEditProfiles(staff);
  const canAddDoctor = canCreateDoctors(staff);
  const canRequestDoctor = canRequestPlatformDoctors(staff);
  const canReviewDoctorRequests = canReviewClinicDoctorRequests(staff);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [grantedDoctorIds, setGrantedDoctorIds] = useState<Set<string>>(() => new Set());
  const [requestDoctorModalOpen, setRequestDoctorModalOpen] = useState(false);
  const [pseExecutives, setPseExecutives] = useState<Admin[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<DoctorQuickFilters>(DEFAULT_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteDoctor, setDeleteDoctor] = useState<Doctor | null>(null);
  const [deletePendingCasesCount, setDeletePendingCasesCount] = useState<number | null>(null);
  const [assignToPseId, setAssignToPseId] = useState<string | null>(null);
  const [deleteDoctorBusy, setDeleteDoctorBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [workspaceLinksByDoctorId, setWorkspaceLinksByDoctorId] = useState(
    () => new Map<string, DoctorWorkspaceLink[]>()
  );
  const [removingLinkKey, setRemovingLinkKey] = useState<string | null>(null);

  const applyDoctorsData = useCallback(
    async (
      doctorsRes: Awaited<ReturnType<typeof fetchAllDoctorsForAdmin>>,
      pseRes: Awaited<ReturnType<typeof fetchPatientServiceExecutives>> | { data: Admin[]; error: null },
      grantsRes: Awaited<ReturnType<typeof fetchGrantedDoctorIdsForClinic>> | { data: string[]; error: null },
      workspaceGrantsRes:
        | Awaited<ReturnType<typeof fetchDoctorWorkspaceGrantsForAdmin>>
        | { data: DoctorWorkspaceLink[]; error: null }
    ) => {
      if (doctorsRes.error) {
        setError(doctorsRes.error.message);
        setDoctors([]);
        setWorkspaceLinksByDoctorId(new Map());
      } else {
        const nextDoctors = doctorsRes.data ?? [];
        setDoctors(nextDoctors);
        setError(null);
        if (isAdmin) {
          const grants = workspaceGrantsRes.error ? [] : (workspaceGrantsRes.data ?? []);
          setWorkspaceLinksByDoctorId(buildDoctorWorkspaceLinksMap(nextDoctors, grants));
        } else {
          setWorkspaceLinksByDoctorId(new Map());
        }
      }
      if (pseRes.error) {
        setPseExecutives([]);
      } else {
        setPseExecutives(pseRes.data ?? []);
      }
      if (grantsRes.error && canRequestDoctor) {
        setGrantedDoctorIds(new Set());
      } else if (canRequestDoctor) {
        setGrantedDoctorIds(new Set(grantsRes.data ?? []));
      }
    },
    [canRequestDoctor, isAdmin]
  );

  const fetchDoctorsData = useCallback(async () => {
    const [doctorsRes, pseRes, grantsRes, workspaceGrantsRes] = await Promise.all([
      fetchAllDoctorsForAdmin(),
      isAdmin ? fetchPatientServiceExecutives() : Promise.resolve({ data: [] as Admin[], error: null }),
      canRequestDoctor && staff.clinic_id
        ? fetchGrantedDoctorIdsForClinic(staff.clinic_id)
        : Promise.resolve({ data: [] as string[], error: null }),
      isAdmin
        ? fetchDoctorWorkspaceGrantsForAdmin()
        : Promise.resolve({ data: [] as DoctorWorkspaceLink[], error: null })
    ]);
    await applyDoctorsData(doctorsRes, pseRes, grantsRes, workspaceGrantsRes);
    return doctorsRes.error;
  }, [applyDoctorsData, canRequestDoctor, isAdmin, staff.clinic_id]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    await fetchDoctorsData();
    setLoading(false);
  }, [fetchDoctorsData]);

  const refresh = useCallback(async () => {
    await fetchDoctorsData();
  }, [fetchDoctorsData]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isAdmin && !(canRequestDoctor && staff.clinic_id)) return;
    return subscribeClinicDoctorsUpdates(() => void refresh(), {
      clinicId: staff.clinic_id,
      isAdmin
    });
  }, [canRequestDoctor, isAdmin, refresh, staff.clinic_id]);

  const analytics = useMemo(() => computeDoctorAnalytics(doctors), [doctors]);

  const specialtyOptions = useMemo(
    () => uniqueSorted(doctors.map((doctor) => doctor.specialty)),
    [doctors]
  );

  const countryOptions = useMemo(
    () =>
      uniqueSorted(
        doctors.map((doctor) => doctor.clinic_country ?? doctor.country)
      ),
    [doctors]
  );

  const normalizedSearch = search.trim().toLowerCase();

  const filteredDoctors = useMemo(() => {
    let list = applyDoctorQuickFilters(doctors, filters);
    if (normalizedSearch) {
      list = list.filter((doctor) => matchesSearch(doctor, normalizedSearch));
    }
    return list;
  }, [doctors, filters, normalizedSearch]);

  const hasActiveFilters =
    Boolean(normalizedSearch) ||
    Boolean(filters.specialty) ||
    Boolean(filters.country) ||
    filters.login !== 'all';

  const openDeleteDoctor = useCallback(async (doctor: Doctor) => {
    setDeleteDoctor(doctor);
    setDeletePendingCasesCount(null);
    setAssignToPseId(null);
    const { count, error: countError } = await countPendingOpinionRequestsForDoctorForAdmin(doctor.id);
    if (countError) {
      setActionMessage(countError.message);
      setDeleteDoctor(null);
      return;
    }
    setDeletePendingCasesCount(count);
  }, []);

  const pseAssigneeOptions = useMemo(
    () =>
      pseExecutives.map((executive) => ({
        value: executive.id,
        label: executive.full_name
      })),
    [pseExecutives]
  );

  const confirmDeleteDoctor = useCallback(async () => {
    const doctor = deleteDoctor;
    if (!doctor || deletePendingCasesCount === null) return;

    if (deletePendingCasesCount > 0 && !assignToPseId) {
      setActionMessage('Select a patient service executive before deleting.');
      return;
    }

    setDeleteDoctorBusy(true);
    setActionMessage(null);

    if (deletePendingCasesCount > 0 && assignToPseId) {
      const { reassignedCount, error: reassignError } =
        await reassignPendingOpinionRequestsToPseForAdmin(doctor.id, assignToPseId, {
          removedDoctorName: doctor.full_name
        });
      if (reassignError) {
        setDeleteDoctorBusy(false);
        setActionMessage(reassignError.message);
        return;
      }

      const pseName =
        pseExecutives.find((executive) => executive.id === assignToPseId)?.full_name ??
        'the selected PSE';
      setSuccessMessage(
        `Assigned ${reassignedCount} pending case${reassignedCount === 1 ? '' : 's'} to ${pseName} for coordination.`
      );
    }

    const { error: deleteError } = await deleteDoctorForAdmin(doctor.id);
    setDeleteDoctorBusy(false);

    if (deleteError) {
      setActionMessage(deleteError.message);
      return;
    }

    setDeleteDoctor(null);
    setDeletePendingCasesCount(null);
    setAssignToPseId(null);
    setSuccessMessage((current) => {
      const deleteNote = `${doctor.full_name} was removed from active doctor listings.`;
      return current ? `${current} ${deleteNote}` : deleteNote;
    });
    setDoctors((current) => current.filter((row) => row.id !== doctor.id));
  }, [deleteDoctor, deletePendingCasesCount, assignToPseId, pseExecutives]);

  const existingDoctorIds = useMemo(() => new Set(doctors.map((doctor) => doctor.id)), [doctors]);

  const handleRemoveFromClinic = useCallback(
    async (doctor: Doctor, link: DoctorWorkspaceLink) => {
      const label = link.linkType === 'granted' ? 'remove platform access' : 'remove this clinic doctor';
      if (
        !window.confirm(
          `${link.linkType === 'granted' ? 'Remove' : 'Delete'} ${doctor.full_name} from ${link.clinicName}? This will ${label} for the clinic PSE workspace.`
        )
      ) {
        return;
      }

      const linkKey = `${link.doctorId}:${link.clinicId}:${link.linkType}`;
      setRemovingLinkKey(linkKey);
      setActionMessage(null);
      setSuccessMessage(null);

      const { removedAs, error: removeError } = await removeDoctorFromClinicWorkspace(
        doctor.id,
        link.clinicId
      );
      setRemovingLinkKey(null);

      if (removeError) {
        setActionMessage(removeError.message);
        return;
      }

      setSuccessMessage(
        removedAs === 'owned'
          ? `${doctor.full_name} was removed from ${link.clinicName}.`
          : `${doctor.full_name} was unlinked from ${link.clinicName}.`
      );
      void load();
    },
    [load]
  );

  const columns = useDoctorsTableColumns({
    canEdit,
    isAdmin,
    grantedDoctorIds: canRequestDoctor ? grantedDoctorIds : undefined,
    workspaceLinksByDoctorId: isAdmin ? workspaceLinksByDoctorId : undefined,
    onRemoveFromClinic: isAdmin ? (doctor, link) => void handleRemoveFromClinic(doctor, link) : undefined,
    removingLinkKey,
    onDeleteDoctor: canEdit ? (doctor) => void openDeleteDoctor(doctor) : undefined
  });

  const clearFilters = useCallback(() => {
    setSearch('');
    setFilters(DEFAULT_FILTERS);
  }, []);

  const handleExport = useCallback(() => {
    exportDoctorsCsv(filteredDoctors);
  }, [filteredDoctors]);

  if (error) {
    return (
      <Alert color='red' radius='md' title='Could not load doctors' className='doctors-mgmt'>
        {error}. Run migration 014_doctor_extended_profile.sql if columns are missing.
      </Alert>
    );
  }

  if (loading && doctors.length === 0) {
    return <DoctorsPageSkeleton />;
  }

  return (
    <div className='doctors-mgmt doctors-mgmt-page elixhealth-datatable-page'>
      <DoctorsPageHeader
        totalCount={doctors.length}
        canEdit={canAddDoctor}
        canRequestPlatformDoctor={canRequestDoctor}
        onOpenFilters={() => setDrawerOpen(true)}
        onExport={handleExport}
        onAddDoctor={() => navigate(ELIX_HEALTH_PATHS.doctorNew)}
        onRequestPlatformDoctor={() => setRequestDoctorModalOpen(true)}
      />

      {canReviewDoctorRequests ? (
        <ClinicDoctorRequestsAdminPanel onReviewed={() => void load()} />
      ) : null}

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

      <DoctorsAnalyticsCards analytics={analytics} loading={loading} />

      <div className='elixhealth-datatable-card doctors-mgmt-table-card'>
        <DoctorsDataTable
          data={filteredDoctors}
          columns={columns}
          isLoading={loading}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          renderToolbar={({ table, fullScreen, onToggleFullScreen }) => (
            <DoctorsTableToolbar
              table={table}
              fullScreen={fullScreen}
              onToggleFullScreen={onToggleFullScreen}
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              specialtyOptions={specialtyOptions}
              countryOptions={countryOptions}
              onFilterChange={setFilters}
            />
          )}
        />
      </div>

      <DoctorsFilterDrawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        filters={filters}
        specialtyOptions={specialtyOptions}
        countryOptions={countryOptions}
        onChange={setFilters}
        onReset={clearFilters}
      />

      <Modal
        opened={Boolean(deleteDoctor)}
        onClose={() => {
          if (!deleteDoctorBusy) {
            setDeleteDoctor(null);
            setDeletePendingCasesCount(null);
            setAssignToPseId(null);
          }
        }}
        title='Delete doctor?'
        radius='lg'
        centered
        classNames={{ content: 'doctors-mgmt-modal' }}
      >
        <Stack gap='md'>
          {deleteDoctor ? (
            <>
              <Text size='sm'>
                Delete <strong>{deleteDoctor.full_name}</strong>? This hides the doctor from patient
                search and removes them from the active admin list.
              </Text>
              {deletePendingCasesCount === null ? (
                <Text size='sm' c='dimmed'>
                  Checking for pending cases…
                </Text>
              ) : deletePendingCasesCount > 0 ? (
                <>
                  <Alert color='yellow' radius='md' title='Pending cases'>
                    This doctor has{' '}
                    <strong>
                      {deletePendingCasesCount} pending case{deletePendingCasesCount === 1 ? '' : 's'}
                    </strong>{' '}
                    (open opinion requests). Assign them to a patient service executive before deleting
                    this profile. The PSE will receive the cases in their request queue to coordinate a
                    replacement specialist.
                  </Alert>
                  <Select
                    label='Assign pending cases to PSE'
                    placeholder='Select a patient service executive…'
                    data={pseAssigneeOptions}
                    value={assignToPseId}
                    onChange={setAssignToPseId}
                    searchable
                    nothingFoundMessage='No active PSE staff found'
                    disabled={deleteDoctorBusy || pseAssigneeOptions.length === 0}
                    radius='md'
                  />
                </>
              ) : (
                <Text size='sm' c='dimmed'>
                  This doctor has no pending cases.
                </Text>
              )}
            </>
          ) : null}
          <Group justify='flex-end' gap='sm'>
            <Button
              variant='default'
              radius='md'
              disabled={deleteDoctorBusy}
              onClick={() => {
                setDeleteDoctor(null);
                setDeletePendingCasesCount(null);
                setAssignToPseId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              color='red'
              radius='md'
              loading={deleteDoctorBusy}
              disabled={
                deletePendingCasesCount === null ||
                (deletePendingCasesCount > 0 && !assignToPseId)
              }
              onClick={() => void confirmDeleteDoctor()}
            >
              {deletePendingCasesCount && deletePendingCasesCount > 0
                ? 'Assign to PSE & delete doctor'
                : 'Delete doctor'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {canRequestDoctor ? (
        <ClinicPseRequestDoctorModal
          opened={requestDoctorModalOpen}
          onClose={() => setRequestDoctorModalOpen(false)}
          staff={staff}
          existingDoctorIds={existingDoctorIds}
          onSubmitted={() => {
            setSuccessMessage('Doctor request submitted. An administrator will review it shortly.');
            void load();
          }}
        />
      ) : null}

    </div>
  );
}

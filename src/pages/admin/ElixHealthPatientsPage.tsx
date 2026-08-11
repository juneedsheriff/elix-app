import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import {
  fetchAllDoctorsForAdmin,
  fetchAllPatientsForAdmin,
  deletePatientForAdmin,
  removePatientFromClinicForAdmin
} from '../../lib/admins';
import {
  countOpinionRequestsForPatient,
  deleteAllOpinionRequestsForPatientForAdmin
} from '../../lib/opinionRequests';
import {
  canBookConsultation,
  canAccessHomeCareRequests,
  canCreatePatients,
  canDeletePatients,
  canDeleteRequests,
  canEditProfiles,
  isAdministrator
} from '../../lib/staffPermissions';
import type { Doctor } from '../../types/doctor';
import type { Patient } from '../../types/patient';
import AssignPatientToClinicModal from './patients/AssignPatientToClinicModal';
import PatientsAnalyticsCards from './patients/PatientsAnalyticsCards';
import PatientsDataTable from './patients/PatientsDataTable';
import PatientsFilterDrawer from './patients/PatientsFilterDrawer';
import PatientsPageHeader from './patients/PatientsPageHeader';
import PatientsPageSkeleton from './patients/PatientsPageSkeleton';
import PatientsTableToolbar from './patients/PatientsTableToolbar';
import {
  applyPatientQuickFilters,
  computePatientAnalytics,
  uniqueSorted,
  type PatientQuickFilters
} from './patients/patientsUtils';
import { usePatientsTableColumns } from './patients/patientsTableColumns';
import { useElixHealthStaff } from './ElixHealthStaffContext';
import WorkspaceTabs from './WorkspaceTabs';
import AdminPatientCreateForm from './forms/AdminPatientCreateForm';
import ClinicPseCreateRequestModal from './requests/ClinicPseCreateRequestModal';
import ClinicPseHomeCareRequestModal from './requests/ClinicPseHomeCareRequestModal';
import { ELIX_HEALTH_PATHS } from './elixHealthRoutes';
import './doctors/doctors-management.css';

const DEFAULT_FILTERS: PatientQuickFilters = {
  country: null,
  city: null,
  bloodGroup: null,
  login: 'all'
};

function matchesSearch(patient: Patient, query: string) {
  const haystack = [
    patient.elix_id,
    patient.full_name,
    patient.email,
    patient.phone,
    patient.city,
    patient.country,
    patient.pse_clinic_name,
    patient.gender,
    patient.blood_group
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

export default function ElixHealthPatientsPage() {
  const navigate = useNavigate();
  const { staff } = useElixHealthStaff();
  const canEdit = canEditProfiles(staff);
  const canAddPatient = canCreatePatients(staff);
  const canDeletePatient = canDeletePatients(staff);
  const canDeletePatientRequests = canDeleteRequests(staff);
  const canBookForPatient = canBookConsultation(staff);
  const canRequestHomeCareForPatient = canAccessHomeCareRequests(staff);
  const isAdmin = isAdministrator(staff);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<PatientQuickFilters>(DEFAULT_FILTERS);
  const [workspaceTab, setWorkspaceTab] = useState('global');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [consultationPatient, setConsultationPatient] = useState<Patient | null>(null);
  const [homeCarePatient, setHomeCarePatient] = useState<Patient | null>(null);
  const [deleteRequestsPatient, setDeleteRequestsPatient] = useState<Patient | null>(null);
  const [deleteRequestsCount, setDeleteRequestsCount] = useState<number | null>(null);
  const [deleteRequestsBusy, setDeleteRequestsBusy] = useState(false);
  const [deletePatient, setDeletePatient] = useState<Patient | null>(null);
  const [deletePatientRequestsCount, setDeletePatientRequestsCount] = useState<number | null>(null);
  const [deletePatientBusy, setDeletePatientBusy] = useState(false);
  const [assignPatient, setAssignPatient] = useState<Patient | null>(null);
  const [removeClinicPatient, setRemoveClinicPatient] = useState<Patient | null>(null);
  const [removeClinicBusy, setRemoveClinicBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [patientsRes, doctorsRes] = await Promise.all([
      fetchAllPatientsForAdmin(),
      canBookForPatient
        ? fetchAllDoctorsForAdmin()
        : Promise.resolve({ data: [] as Doctor[], error: null })
    ]);
    if (patientsRes.error) {
      setError(patientsRes.error.message);
      setPatients([]);
    } else {
      setPatients(patientsRes.data ?? []);
    }
    if (doctorsRes.error) {
      setError(doctorsRes.error.message);
      setDoctors([]);
    } else if (canBookForPatient) {
      setDoctors(doctorsRes.data ?? []);
    }
    setLoading(false);
  }, [canBookForPatient]);

  useEffect(() => {
    void load();
  }, [load]);

  const workspaceTabs = useMemo(() => {
    if (!isAdmin) return [] as Array<{ value: string; label: string }>;

    const clinics = new Map<string, { name: string; count: number }>();
    let globalCount = 0;

    for (const patient of patients) {
      if (!patient.clinic_id) {
        globalCount += 1;
        continue;
      }

      const current = clinics.get(patient.clinic_id);
      if (current) {
        current.count += 1;
      } else {
        clinics.set(patient.clinic_id, {
          name: patient.pse_clinic_name?.trim() || 'Clinic workspace',
          count: 1
        });
      }
    }

    const clinicEntries = [...clinics.entries()]
      .map(([id, clinic]) => ({ id, name: clinic.name, count: clinic.count }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const clinicNameCounts = new Map<string, number>();
    for (const entry of clinicEntries) {
      clinicNameCounts.set(entry.name, (clinicNameCounts.get(entry.name) ?? 0) + 1);
    }

    const clinicTabs = clinicEntries.map((entry) => {
      const duplicateName = (clinicNameCounts.get(entry.name) ?? 0) > 1;
      const needsIdHint = duplicateName || entry.name === 'Clinic workspace';
      const idHint = needsIdHint ? ` · ${entry.id.slice(0, 8)}` : '';
      return {
        value: `clinic:${entry.id}`,
        label: `${entry.name}${idHint} (${entry.count})`
      };
    });

    return [{ value: 'global', label: `Global (${globalCount})` }, ...clinicTabs];
  }, [isAdmin, patients]);

  useEffect(() => {
    if (!isAdmin) return;
    if (!workspaceTabs.length) {
      if (workspaceTab !== 'global') setWorkspaceTab('global');
      return;
    }
    if (!workspaceTabs.some((tab) => tab.value === workspaceTab)) {
      setWorkspaceTab('global');
    }
  }, [isAdmin, workspaceTab, workspaceTabs]);

  const workspaceScopedPatients = useMemo(() => {
    if (!isAdmin) return patients;
    if (workspaceTab === 'global') {
      return patients.filter((patient) => !patient.clinic_id);
    }
    if (workspaceTab.startsWith('clinic:')) {
      const clinicId = workspaceTab.slice('clinic:'.length);
      return patients.filter((patient) => patient.clinic_id === clinicId);
    }
    return patients;
  }, [isAdmin, patients, workspaceTab]);

  const analytics = useMemo(
    () => computePatientAnalytics(workspaceScopedPatients),
    [workspaceScopedPatients]
  );

  const cityOptions = useMemo(
    () => uniqueSorted(workspaceScopedPatients.map((patient) => patient.city)),
    [workspaceScopedPatients]
  );

  const bloodGroupOptions = useMemo(
    () => uniqueSorted(workspaceScopedPatients.map((patient) => patient.blood_group)),
    [workspaceScopedPatients]
  );

  const normalizedSearch = search.trim().toLowerCase();

  const filteredPatients = useMemo(() => {
    let list = applyPatientQuickFilters(workspaceScopedPatients, filters);
    if (normalizedSearch) {
      list = list.filter((patient) => matchesSearch(patient, normalizedSearch));
    }
    return list;
  }, [filters, normalizedSearch, workspaceScopedPatients]);

  const hasActiveFilters =
    Boolean(normalizedSearch) ||
    Boolean(filters.country) ||
    Boolean(filters.city) ||
    Boolean(filters.bloodGroup) ||
    filters.login !== 'all';

  const openDeleteAllRequests = useCallback(async (patient: Patient) => {
    if (!patient.auth_user_id) {
      setActionMessage('This patient has no login account — opinion requests cannot be bulk-deleted by profile.');
      setSuccessMessage(null);
      return;
    }

    setDeleteRequestsPatient(patient);
    setDeleteRequestsCount(null);
    const { count, error: countError } = await countOpinionRequestsForPatient(patient.auth_user_id);
    if (countError) {
      setActionMessage(countError.message);
      setDeleteRequestsPatient(null);
      return;
    }
    setDeleteRequestsCount(count);
  }, []);

  const confirmDeleteAllRequests = useCallback(async () => {
    const patient = deleteRequestsPatient;
    if (!patient?.auth_user_id) return;

    setDeleteRequestsBusy(true);
    setActionMessage(null);
    const { deletedCount, error: deleteError } = await deleteAllOpinionRequestsForPatientForAdmin(
      patient.auth_user_id
    );
    setDeleteRequestsBusy(false);

    if (deleteError) {
      setActionMessage(deleteError.message);
      return;
    }

    setDeleteRequestsPatient(null);
    setDeleteRequestsCount(null);
    setSuccessMessage(
      `Deleted ${deletedCount} opinion request${deletedCount === 1 ? '' : 's'} for ${patient.full_name}.`
    );
  }, [deleteRequestsPatient]);

  const openDeletePatient = useCallback(async (patient: Patient) => {
    setDeletePatient(patient);
    setDeletePatientRequestsCount(null);
    if (patient.auth_user_id) {
      const { count, error: countError } = await countOpinionRequestsForPatient(patient.auth_user_id);
      if (countError) {
        setActionMessage(countError.message);
        setDeletePatient(null);
        return;
      }
      setDeletePatientRequestsCount(count);
    } else {
      setDeletePatientRequestsCount(0);
    }
  }, []);

  const confirmDeletePatient = useCallback(async () => {
    const patient = deletePatient;
    if (!patient) return;

    setDeletePatientBusy(true);
    setActionMessage(null);
    const { error: deleteError } = await deletePatientForAdmin(patient.id);
    setDeletePatientBusy(false);

    if (deleteError) {
      setActionMessage(deleteError.message);
      return;
    }

    setDeletePatient(null);
    setDeletePatientRequestsCount(null);
    setPatients((current) => current.filter((row) => row.id !== patient.id));
    setSuccessMessage(`${patient.full_name} was permanently deleted.`);
  }, [deletePatient]);

  const confirmRemoveFromClinic = useCallback(async () => {
    const patient = removeClinicPatient;
    if (!patient) return;

    setRemoveClinicBusy(true);
    setActionMessage(null);
    const { data, transferredRequests, error: removeError } = await removePatientFromClinicForAdmin(
      patient.id
    );
    setRemoveClinicBusy(false);

    if (removeError || !data) {
      setActionMessage(removeError?.message ?? 'Could not remove clinic assignment.');
      return;
    }

    setRemoveClinicPatient(null);
    setPatients((current) =>
      current.map((row) => (row.id === data.id ? { ...row, ...data } : row))
    );
    setWorkspaceTab('global');
    const requestNote =
      transferredRequests > 0
        ? ` Moved ${transferredRequests} opinion request${transferredRequests === 1 ? '' : 's'} back to Global.`
        : '';
    setSuccessMessage(`${data.full_name} was returned to Global Patients.${requestNote}`);
  }, [removeClinicPatient]);

  const columns = usePatientsTableColumns({
    canEdit,
    isAdmin,
    onAssignToClinic: isAdmin ? (patient) => setAssignPatient(patient) : undefined,
    onRemoveFromClinic: isAdmin ? (patient) => setRemoveClinicPatient(patient) : undefined,
    onDeleteAllRequests: canDeletePatientRequests
      ? (patient) => void openDeleteAllRequests(patient)
      : undefined,
    onDeletePatient: canDeletePatient ? (patient) => void openDeletePatient(patient) : undefined,
    onBookConsultation: canBookForPatient
      ? (patient) => {
          setHomeCarePatient(null);
          setConsultationPatient(patient);
        }
      : undefined,
    onRequestHomeCare: canRequestHomeCareForPatient
      ? (patient) => {
          setConsultationPatient(null);
          setHomeCarePatient(patient);
        }
      : undefined
  });

  const clearFilters = useCallback(() => {
    setSearch('');
    setFilters(DEFAULT_FILTERS);
  }, []);

  if (error) {
    const hint = error.toLowerCase().includes('infinite recursion')
      ? ' Run npm run db:apply-doctors-rls-fix (migrations 057 + 058).'
      : '';
    return (
      <Alert color='red' radius='md' title='Could not load patients' className='doctors-mgmt'>
        {error}
        {hint}
      </Alert>
    );
  }

  if (loading && patients.length === 0) {
    return <PatientsPageSkeleton />;
  }

  return (
    <div className='doctors-mgmt doctors-mgmt-page elixhealth-datatable-page'>
      <PatientsPageHeader
        totalCount={workspaceScopedPatients.length}
        canEdit={canEdit || canAddPatient}
        onOpenFilters={() => setDrawerOpen(true)}
        onAddPatient={() => setAddModalOpen(true)}
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
        <WorkspaceTabs tabs={workspaceTabs} value={workspaceTab} onChange={setWorkspaceTab} />
      ) : null}

      <PatientsAnalyticsCards analytics={analytics} loading={loading} />

      <div className='elixhealth-datatable-card doctors-mgmt-table-card'>
        <PatientsDataTable
          data={filteredPatients}
          columns={columns}
          isLoading={loading}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          renderToolbar={({ table, fullScreen, onToggleFullScreen }) => (
            <PatientsTableToolbar
              table={table}
              fullScreen={fullScreen}
              onToggleFullScreen={onToggleFullScreen}
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              cityOptions={cityOptions}
              onFilterChange={setFilters}
            />
          )}
        />
      </div>

      <PatientsFilterDrawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        filters={filters}
        cityOptions={cityOptions}
        bloodGroupOptions={bloodGroupOptions}
        onChange={setFilters}
        onReset={clearFilters}
      />

      <Modal
        opened={Boolean(deleteRequestsPatient)}
        onClose={() => {
          if (!deleteRequestsBusy) {
            setDeleteRequestsPatient(null);
            setDeleteRequestsCount(null);
          }
        }}
        title='Delete all opinion requests'
        radius='lg'
        centered
        classNames={{ content: 'doctors-mgmt-modal' }}
      >
        <Stack gap='md'>
          <Text size='sm'>
            {deleteRequestsPatient ? (
              <>
                Permanently delete{' '}
                <strong>
                  {deleteRequestsCount === null
                    ? '…'
                    : `${deleteRequestsCount} request${deleteRequestsCount === 1 ? '' : 's'}`}
                </strong>{' '}
                for <strong>{deleteRequestsPatient.full_name}</strong>? This removes them from the
                patient app, PSE queue, and doctor dashboard. Medical record files in the vault are
                not deleted.
              </>
            ) : null}
          </Text>
          <Group justify='flex-end' gap='sm'>
            <Button
              variant='default'
              radius='md'
              disabled={deleteRequestsBusy}
              onClick={() => {
                setDeleteRequestsPatient(null);
                setDeleteRequestsCount(null);
              }}
            >
              Cancel
            </Button>
            <Button
              color='red'
              radius='md'
              loading={deleteRequestsBusy}
              disabled={deleteRequestsCount === 0}
              onClick={() => void confirmDeleteAllRequests()}
            >
              Delete all
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(deletePatient)}
        onClose={() => {
          if (!deletePatientBusy) {
            setDeletePatient(null);
            setDeletePatientRequestsCount(null);
          }
        }}
        title='Delete patient?'
        radius='lg'
        centered
        classNames={{ content: 'doctors-mgmt-modal' }}
      >
        <Stack gap='md'>
          <Text size='sm'>
            {deletePatient ? (
              <>
                Permanently delete <strong>{deletePatient.full_name}</strong>? This cannot be undone.
                Their profile, login account, and linked opinion requests will be removed
                {deletePatientRequestsCount !== null && deletePatientRequestsCount > 0 ? (
                  <>
                    {' '}
                    ({deletePatientRequestsCount} request
                    {deletePatientRequestsCount === 1 ? '' : 's'} will also be deleted).
                  </>
                ) : (
                  '.'
                )}
              </>
            ) : null}
          </Text>
          <Group justify='flex-end' gap='sm'>
            <Button
              variant='default'
              radius='md'
              disabled={deletePatientBusy}
              onClick={() => {
                setDeletePatient(null);
                setDeletePatientRequestsCount(null);
              }}
            >
              Cancel
            </Button>
            <Button
              color='red'
              radius='md'
              loading={deletePatientBusy}
              disabled={deletePatientRequestsCount === null}
              onClick={() => void confirmDeletePatient()}
            >
              Delete permanently
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title='Add patient'
        radius='lg'
        centered
        classNames={{ content: 'doctors-mgmt-modal' }}
      >
        {canAddPatient && staff.clinic_id ? (
          <AdminPatientCreateForm
            clinicId={staff.clinic_id}
            onCancel={() => setAddModalOpen(false)}
            onCreated={(result) => {
              setAddModalOpen(false);
              setSuccessMessage(
                result?.warning
                  ? 'Patient created. Login was enabled, but check warning details.'
                  : 'Patient created. Login enabled and credentials emailed.'
              );
              setActionMessage(result?.warning ?? null);
              void load();
            }}
          />
        ) : (
          <Stack gap='sm'>
            <Text size='sm' c='dimmed'>
              New patient profiles are created through registration or your onboarding workflow.
              Once a record exists, you can manage profile and login settings from this console.
            </Text>
            <Text size='sm'>
              To edit an existing patient, use the table actions or open a name from the list.
            </Text>
          </Stack>
        )}
      </Modal>

      <AssignPatientToClinicModal
        patient={assignPatient}
        opened={Boolean(assignPatient)}
        onClose={() => setAssignPatient(null)}
        onAssigned={(updated, clinicName, transferredRequests) => {
          setPatients((current) =>
            current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row))
          );
          setWorkspaceTab(`clinic:${updated.clinic_id}`);
          const requestNote =
            transferredRequests > 0
              ? ` Moved ${transferredRequests} opinion request${transferredRequests === 1 ? '' : 's'} to the clinic queue.`
              : '';
          setSuccessMessage(
            `${updated.full_name} was assigned to ${clinicName}.${requestNote}`
          );
          setActionMessage(null);
        }}
      />

      {canBookForPatient ? (
        <ClinicPseCreateRequestModal
          opened={Boolean(consultationPatient)}
          onClose={() => setConsultationPatient(null)}
          staff={staff}
          patients={patients}
          doctors={doctors}
          initialPatientId={consultationPatient?.id ?? null}
          allowCreatePatient={false}
          lockPatient
          onCreated={(requestId) => {
            setConsultationPatient(null);
            navigate(
              `${ELIX_HEALTH_PATHS.requests}?id=${encodeURIComponent(requestId)}&created=1`,
              { replace: false }
            );
          }}
        />
      ) : null}

      {canRequestHomeCareForPatient && staff.clinic_id ? (
        <ClinicPseHomeCareRequestModal
          opened={Boolean(homeCarePatient)}
          onClose={() => setHomeCarePatient(null)}
          staff={staff}
          patients={patients}
          initialPatientId={homeCarePatient?.id ?? null}
          lockPatient
          allowCreatePatient={false}
          onCreated={(requestId) => {
            setHomeCarePatient(null);
            navigate(
              `${ELIX_HEALTH_PATHS.requests}?tab=homecare&id=${encodeURIComponent(requestId)}&created=1`,
              { replace: false }
            );
          }}
        />
      ) : null}

      <Modal
        opened={Boolean(removeClinicPatient)}
        onClose={() => {
          if (!removeClinicBusy) setRemoveClinicPatient(null);
        }}
        title='Remove from clinic?'
        radius='lg'
        centered
        classNames={{ content: 'doctors-mgmt-modal' }}
      >
        <Stack gap='md'>
          <Text size='sm'>
            {removeClinicPatient ? (
              <>
                Return <strong>{removeClinicPatient.full_name}</strong> to Global Patients? The
                clinic PSE will no longer manage this patient. Their opinion requests move back to
                the platform queue.
              </>
            ) : null}
          </Text>
          <Group justify='flex-end' gap='sm'>
            <Button
              variant='default'
              radius='md'
              disabled={removeClinicBusy}
              onClick={() => setRemoveClinicPatient(null)}
            >
              Cancel
            </Button>
            <Button
              color='orange'
              radius='md'
              loading={removeClinicBusy}
              onClick={() => void confirmRemoveFromClinic()}
            >
              Remove from clinic
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}

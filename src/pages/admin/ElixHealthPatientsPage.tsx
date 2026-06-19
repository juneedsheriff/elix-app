import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { fetchAllPatientsForAdmin } from '../../lib/admins';
import {
  countOpinionRequestsForPatient,
  deleteAllOpinionRequestsForPatientForAdmin
} from '../../lib/opinionRequests';
import { canCreatePatients, canEditProfiles, isAdministrator } from '../../lib/staffPermissions';
import type { Patient } from '../../types/patient';
import PatientsAnalyticsCards from './patients/PatientsAnalyticsCards';
import PatientsDataTable from './patients/PatientsDataTable';
import PatientsFilterDrawer from './patients/PatientsFilterDrawer';
import PatientsPageHeader from './patients/PatientsPageHeader';
import PatientsPageSkeleton from './patients/PatientsPageSkeleton';
import PatientsTableToolbar from './patients/PatientsTableToolbar';
import {
  applyPatientQuickFilters,
  computePatientAnalytics,
  exportPatientsCsv,
  uniqueSorted,
  type PatientQuickFilters
} from './patients/patientsUtils';
import { usePatientsTableColumns } from './patients/patientsTableColumns';
import { useElixHealthStaff } from './ElixHealthStaffContext';
import AdminPatientCreateForm from './forms/AdminPatientCreateForm';
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
  const { staff } = useElixHealthStaff();
  const canEdit = canEditProfiles(staff);
  const canAddPatient = canCreatePatients(staff);
  const isAdmin = isAdministrator(staff);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<PatientQuickFilters>(DEFAULT_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteRequestsPatient, setDeleteRequestsPatient] = useState<Patient | null>(null);
  const [deleteRequestsCount, setDeleteRequestsCount] = useState<number | null>(null);
  const [deleteRequestsBusy, setDeleteRequestsBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await fetchAllPatientsForAdmin();
    if (fetchError) {
      setError(fetchError.message);
      setPatients([]);
    } else {
      setPatients(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const analytics = useMemo(() => computePatientAnalytics(patients), [patients]);

  const countryOptions = useMemo(
    () => uniqueSorted(patients.map((patient) => patient.country)),
    [patients]
  );

  const cityOptions = useMemo(
    () => uniqueSorted(patients.map((patient) => patient.city)),
    [patients]
  );

  const bloodGroupOptions = useMemo(
    () => uniqueSorted(patients.map((patient) => patient.blood_group)),
    [patients]
  );

  const normalizedSearch = search.trim().toLowerCase();

  const filteredPatients = useMemo(() => {
    let list = applyPatientQuickFilters(patients, filters);
    if (normalizedSearch) {
      list = list.filter((patient) => matchesSearch(patient, normalizedSearch));
    }
    return list;
  }, [patients, filters, normalizedSearch]);

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

  const columns = usePatientsTableColumns({
    canEdit,
    isAdmin,
    onDeleteAllRequests: isAdmin ? (patient) => void openDeleteAllRequests(patient) : undefined
  });

  const clearFilters = useCallback(() => {
    setSearch('');
    setFilters(DEFAULT_FILTERS);
  }, []);

  const handleExport = useCallback(() => {
    exportPatientsCsv(filteredPatients);
  }, [filteredPatients]);

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
        totalCount={patients.length}
        canEdit={canEdit || canAddPatient}
        onOpenFilters={() => setDrawerOpen(true)}
        onExport={handleExport}
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
              countryOptions={countryOptions}
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
        countryOptions={countryOptions}
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
            onCreated={() => {
              setAddModalOpen(false);
              setSuccessMessage('Patient created.');
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
    </div>
  );
}

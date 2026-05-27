import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Stack, Text } from '@mantine/core';
import { fetchAllPatientsForAdmin } from '../../lib/admins';
import { canEditProfiles } from '../../lib/staffPermissions';
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
    patient.gender,
    patient.blood_group
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

export default function ElixHealthPatientsPage() {
  const staff = useElixHealthStaff();
  const canEdit = canEditProfiles(staff);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<PatientQuickFilters>(DEFAULT_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

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

  const columns = usePatientsTableColumns({ canEdit });

  const clearFilters = useCallback(() => {
    setSearch('');
    setFilters(DEFAULT_FILTERS);
  }, []);

  const handleExport = useCallback(() => {
    exportPatientsCsv(filteredPatients);
  }, [filteredPatients]);

  if (error) {
    return (
      <Alert color='red' radius='md' title='Could not load patients' className='doctors-mgmt'>
        {error}
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
        canEdit={canEdit}
        onOpenFilters={() => setDrawerOpen(true)}
        onExport={handleExport}
        onAddPatient={() => setAddModalOpen(true)}
      />

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
        opened={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title='Add patient'
        radius='lg'
        centered
        classNames={{ content: 'doctors-mgmt-modal' }}
      >
        <Stack gap='sm'>
          <Text size='sm' c='dimmed'>
            New patient profiles are created through registration or your onboarding workflow.
            Once a record exists, you can manage profile and login settings from this console.
          </Text>
          <Text size='sm'>
            To edit an existing patient, use the table actions or open a name from the list.
          </Text>
        </Stack>
      </Modal>
    </div>
  );
}

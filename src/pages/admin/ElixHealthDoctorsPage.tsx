import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '@mantine/core';
import { fetchAllDoctorsForAdmin } from '../../lib/admins';
import { canEditProfiles } from '../../lib/staffPermissions';
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
  const staff = useElixHealthStaff();
  const canEdit = canEditProfiles(staff);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<DoctorQuickFilters>(DEFAULT_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await fetchAllDoctorsForAdmin();
    if (fetchError) {
      setError(fetchError.message);
      setDoctors([]);
    } else {
      setDoctors(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  const columns = useDoctorsTableColumns({ canEdit });

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
        canEdit={canEdit}
        onOpenFilters={() => setDrawerOpen(true)}
        onExport={handleExport}
        onAddDoctor={() => navigate(ELIX_HEALTH_PATHS.doctorNew)}
      />

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

    </div>
  );
}

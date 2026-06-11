import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useSupabase } from '../../context/SupabaseProvider';
import { supabase } from '../../lib/supabase';
import { clearAuthSurface } from '../../lib/navigation/authSurface';
import { adminSignOut } from '../../lib/admins';
import type { Doctor } from '../../types/doctor';
import AvailabilityPage from '../doctor/AvailabilityPage';
import CaseReviewPage from '../doctor/CaseReviewPage';
import DoctorConsultationPage from '../doctor/DoctorConsultationPage';
import DoctorDashboardPage from '../doctor/DoctorDashboardPage';
import { doctorWorkspacePath, ELIX_HEALTH_PATHS } from './elixHealthRoutes';
import ElixHealthDoctorLayout from './ElixHealthDoctorLayout';
import ElixHealthMantineProvider from './ElixHealthMantineProvider';

function ElixHealthDoctorRoutes({ doctor }: { doctor: Doctor }) {
  const navigate = useNavigate();
  const { configured } = useSupabase();
  const [dbConnected, setDbConnected] = useState(false);

  useEffect(() => {
    if (!configured) {
      setDbConnected(false);
      return;
    }
    supabase.auth.getSession().then(({ error }) => {
      setDbConnected(!error);
    });
  }, [configured]);

  const onNavigate = useCallback(
    (screenId: string) => {
      navigate(doctorWorkspacePath(screenId));
    },
    [navigate]
  );

  const pageProps = {
    doctorProfile: doctor,
    dbConnected: dbConnected && configured,
    onNavigate
  };

  return (
    <Routes>
      <Route index element={<DoctorDashboardPage {...pageProps} />} />
      <Route path='cases' element={<CaseReviewPage {...pageProps} />} />
      <Route path='consultation' element={<DoctorConsultationPage {...pageProps} />} />
      <Route path='availability' element={<AvailabilityPage />} />
    </Routes>
  );
}

type ElixHealthDoctorShellProps = {
  doctor: Doctor;
  onSignOut: () => void;
};

export default function ElixHealthDoctorShell({ doctor, onSignOut }: ElixHealthDoctorShellProps) {
  const location = useLocation();

  return (
    <ElixHealthMantineProvider>
      <ElixHealthDoctorLayout doctor={doctor} pathname={location.pathname} onSignOut={onSignOut}>
        <ElixHealthDoctorRoutes doctor={doctor} />
      </ElixHealthDoctorLayout>
    </ElixHealthMantineProvider>
  );
}

export function ElixHealthDoctorGuard({
  doctor,
  onSignOut
}: {
  doctor: Doctor | null;
  onSignOut: () => void;
}) {
  if (!doctor) {
    return <Navigate to='/elixhealth/login' replace />;
  }
  return <ElixHealthDoctorShell doctor={doctor} onSignOut={onSignOut} />;
}

export async function doctorSignOut() {
  clearAuthSurface();
  await adminSignOut();
}

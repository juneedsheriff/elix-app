import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useSupabase } from '../../context/SupabaseProvider';
import { adminSignIn, adminSignOut, fetchAdminByAuthUserId } from '../../lib/admins';
import type { Admin } from '../../types/admin';
import { ElixHealthAdminGuard } from './ElixHealthAdminShell';
import ElixHealthDoctorEditPage from './ElixHealthDoctorEditPage';
import ElixHealthDoctorsPage from './ElixHealthDoctorsPage';
import ElixHealthLogin from './ElixHealthLogin';
import ElixHealthOverviewPage from './ElixHealthOverviewPage';
import ElixHealthPatientEditPage from './ElixHealthPatientEditPage';
import ElixHealthPatientsPage from './ElixHealthPatientsPage';
import ElixHealthRequestsPage from './ElixHealthRequestsPage';
import ElixHealthStaffPage from './ElixHealthStaffPage';
import { AdministratorOnly } from './AdministratorOnly';

export default function ElixHealthApp() {
  const navigate = useNavigate();
  const { configured, loading: authLoading, session } = useSupabase();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifySession = useCallback(async () => {
    if (!session?.user) {
      setAdmin(null);
      setChecking(false);
      return;
    }

    setChecking(true);
    const { data, error: fetchError } = await fetchAdminByAuthUserId(session.user.id);
    if (fetchError || !data) {
      setAdmin(null);
      if (session) await adminSignOut();
    } else {
      setAdmin(data);
    }
    setChecking(false);
  }, [session]);

  useEffect(() => {
    if (authLoading) return;
    void verifySession();
  }, [authLoading, verifySession]);

  const handleSignIn = async (email: string, password: string) => {
    setBusy(true);
    setError(null);
    const { error: signInError, admin: signedInAdmin } = await adminSignIn(email, password);
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    setAdmin(signedInAdmin);
    navigate('/elixhealth', { replace: true });
  };

  const handleSignOut = async () => {
    await adminSignOut();
    setAdmin(null);
    navigate('/elixhealth/login', { replace: true });
  };

  if (authLoading || checking) {
    return (
      <div className='elixhealth-shell'>
        <p className='muted'>Loading…</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path='login'
        element={
          admin ? (
            <Navigate to='/elixhealth' replace />
          ) : (
            <ElixHealthLogin
              configured={configured}
              busy={busy}
              error={error}
              onSignIn={(email, password) => void handleSignIn(email, password)}
            />
          )
        }
      />
      <Route
        element={<ElixHealthAdminGuard admin={admin} onSignOut={() => void handleSignOut()} />}
      >
        <Route index element={<ElixHealthOverviewPage />} />
        <Route path='doctors' element={<ElixHealthDoctorsPage />} />
        <Route path='doctor' element={<ElixHealthDoctorEditPage />} />
        <Route path='patients' element={<ElixHealthPatientsPage />} />
        <Route path='patient' element={<ElixHealthPatientEditPage />} />
        <Route path='requests' element={<ElixHealthRequestsPage />} />
        <Route path='staff' element={<AdministratorOnly><ElixHealthStaffPage /></AdministratorOnly>} />
      </Route>
      <Route path='*' element={<Navigate to={admin ? '/elixhealth' : '/elixhealth/login'} replace />} />
    </Routes>
  );
}

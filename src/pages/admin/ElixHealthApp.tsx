import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useSupabase } from '../../context/SupabaseProvider';
import { adminSignOut, fetchAdminByAuthUserId } from '../../lib/admins';
import { elixhealthSignIn } from '../../lib/elixhealthAuth';
import { appScreenPath } from '../../lib/navigation/appRoutes';
import { clearAuthSurface, getAuthSurface, setAuthSurface } from '../../lib/navigation/authSurface';
import type { Admin } from '../../types/admin';
import { ElixHealthAdminGuard } from './ElixHealthAdminShell';
import ElixHealthDoctorCreatePage from './ElixHealthDoctorCreatePage';
import ElixHealthDoctorEditPage from './ElixHealthDoctorEditPage';
import ElixHealthDoctorsPage from './ElixHealthDoctorsPage';
import { doctorSignOut, ElixHealthDoctorGuard } from './ElixHealthDoctorShell';
import { ELIX_HEALTH_PATHS } from './elixHealthRoutes';
import ElixHealthLogin from './ElixHealthLogin';
import ElixHealthOverviewPage from './ElixHealthOverviewPage';
import ElixHealthPatientEditPage from './ElixHealthPatientEditPage';
import ElixHealthPatientsPage from './ElixHealthPatientsPage';
import ElixHealthRequestsPage from './ElixHealthRequestsPage';
import ElixHealthStaffPage from './ElixHealthStaffPage';
import { AdministratorOnly } from './AdministratorOnly';
import ElixPreloader from '../../components/ui/ElixPreloader';

export default function ElixHealthApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { configured, loading: authLoading, session, doctorProfile } = useSupabase();
  const userId = session?.user?.id ?? null;
  const [admin, setAdmin] = useState<Admin | null>(null);
  const adminRef = useRef(admin);
  adminRef.current = admin;
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDoctorUser =
    !admin &&
    doctorProfile != null &&
    doctorProfile.auth_user_id === userId &&
    !doctorProfile.login_disabled;

  const verifySession = useCallback(async () => {
    if (!userId) {
      setAdmin(null);
      setChecking(false);
      return;
    }

    const alreadyVerified = adminRef.current?.auth_user_id === userId;
    if (!alreadyVerified) {
      setChecking(true);
    }

    const { data } = await fetchAdminByAuthUserId(userId);
    setAdmin(data ?? null);
    setChecking(false);
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;
    void verifySession();
  }, [authLoading, verifySession]);

  useEffect(() => {
    if (authLoading || checking) return;
    if (!isDoctorUser || location.pathname.endsWith('/login')) return;
    if (getAuthSurface() === 'mobile') {
      navigate(appScreenPath('doctor-dashboard'), { replace: true });
    }
  }, [authLoading, checking, isDoctorUser, location.pathname, navigate]);

  const handleSignIn = async (email: string, password: string) => {
    setBusy(true);
    setError(null);
    const { error: signInError, admin: signedInAdmin, doctor: signedInDoctor } = await elixhealthSignIn(
      email,
      password
    );
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }

    setAuthSurface('desktop');
    if (signedInAdmin) {
      setAdmin(signedInAdmin);
      navigate(ELIX_HEALTH_PATHS.overview, { replace: true });
      return;
    }
    if (signedInDoctor) {
      setAdmin(null);
      navigate(ELIX_HEALTH_PATHS.workspace, { replace: true });
    }
  };

  const handleStaffSignOut = async () => {
    clearAuthSurface();
    await adminSignOut();
    setAdmin(null);
    navigate('/elixhealth/login', { replace: true });
  };

  const handleDoctorSignOut = async () => {
    await doctorSignOut();
    navigate('/elixhealth/login', { replace: true });
  };

  const loginRedirect = admin
    ? ELIX_HEALTH_PATHS.overview
    : isDoctorUser
      ? ELIX_HEALTH_PATHS.workspace
      : null;

  if (authLoading || checking) {
    return <ElixPreloader />;
  }

  return (
    <Routes>
      <Route
        path='login'
        element={
          loginRedirect ? (
            <Navigate to={loginRedirect} replace />
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
        element={<ElixHealthAdminGuard admin={admin} onSignOut={() => void handleStaffSignOut()} />}
      >
        <Route index element={<ElixHealthOverviewPage />} />
        <Route path='doctors' element={<ElixHealthDoctorsPage />} />
        <Route
          path='doctor/new'
          element={
            <AdministratorOnly>
              <ElixHealthDoctorCreatePage />
            </AdministratorOnly>
          }
        />
        <Route path='doctor' element={<ElixHealthDoctorEditPage />} />
        <Route path='patients' element={<ElixHealthPatientsPage />} />
        <Route path='patient' element={<ElixHealthPatientEditPage />} />
        <Route path='requests' element={<ElixHealthRequestsPage />} />
        <Route path='staff' element={<AdministratorOnly><ElixHealthStaffPage /></AdministratorOnly>} />
      </Route>
      <Route
        path='workspace/*'
        element={
          <ElixHealthDoctorGuard doctor={isDoctorUser ? doctorProfile : null} onSignOut={() => void handleDoctorSignOut()} />
        }
      />
      <Route
        path='*'
        element={
          <Navigate
            to={admin ? ELIX_HEALTH_PATHS.overview : isDoctorUser ? ELIX_HEALTH_PATHS.workspace : '/elixhealth/login'}
            replace
          />
        }
      />
    </Routes>
  );
}

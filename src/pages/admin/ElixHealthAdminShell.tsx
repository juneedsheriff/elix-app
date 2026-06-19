import { useCallback } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Admin } from '../../types/admin';
import { fetchAdminByAuthUserId } from '../../lib/admins';
import ElixHealthMantineProvider from './ElixHealthMantineProvider';
import ElixHealthLayout from './ElixHealthLayout';
import { ElixHealthStaffContext } from './ElixHealthStaffContext';
import { navIdFromPathname, pageTitleFromPathname } from './elixHealthRoutes';

type ElixHealthAdminShellProps = {
  admin: Admin;
  onStaffUpdated: (admin: Admin) => void;
  onSignOut: () => void;
};

export default function ElixHealthAdminShell({ admin, onStaffUpdated, onSignOut }: ElixHealthAdminShellProps) {
  const location = useLocation();
  const activeNav = navIdFromPathname(location.pathname);
  const pageTitle = pageTitleFromPathname(location.pathname, location.search);

  const refreshStaff = useCallback(async () => {
    if (!admin.auth_user_id) return;
    const { data } = await fetchAdminByAuthUserId(admin.auth_user_id);
    if (data) onStaffUpdated(data);
  }, [admin.auth_user_id, onStaffUpdated]);

  return (
    <ElixHealthMantineProvider>
      <ElixHealthStaffContext.Provider value={{ staff: admin, refreshStaff }}>
        <ElixHealthLayout admin={admin} activeNav={activeNav} pageTitle={pageTitle} onSignOut={onSignOut}>
          <Outlet />
        </ElixHealthLayout>
      </ElixHealthStaffContext.Provider>
    </ElixHealthMantineProvider>
  );
}

export function ElixHealthAdminGuard({
  admin,
  onStaffUpdated,
  onSignOut
}: {
  admin: Admin | null;
  onStaffUpdated: (admin: Admin) => void;
  onSignOut: () => void;
}) {
  if (!admin) {
    return <Navigate to='/elixhealth/login' replace />;
  }
  return <ElixHealthAdminShell admin={admin} onStaffUpdated={onStaffUpdated} onSignOut={onSignOut} />;
}

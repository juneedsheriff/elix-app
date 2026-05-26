import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Admin } from '../../types/admin';
import ElixHealthLayout from './ElixHealthLayout';
import { navIdFromPathname, pageTitleFromPathname } from './elixHealthRoutes';

type ElixHealthAdminShellProps = {
  admin: Admin;
  onSignOut: () => void;
};

export default function ElixHealthAdminShell({ admin, onSignOut }: ElixHealthAdminShellProps) {
  const location = useLocation();
  const activeNav = navIdFromPathname(location.pathname);
  const pageTitle = pageTitleFromPathname(location.pathname, location.search);

  return (
    <ElixHealthLayout admin={admin} activeNav={activeNav} pageTitle={pageTitle} onSignOut={onSignOut}>
      <Outlet />
    </ElixHealthLayout>
  );
}

export function ElixHealthAdminGuard({
  admin,
  onSignOut
}: {
  admin: Admin | null;
  onSignOut: () => void;
}) {
  if (!admin) {
    return <Navigate to='/elixhealth/login' replace />;
  }
  return <ElixHealthAdminShell admin={admin} onSignOut={onSignOut} />;
}

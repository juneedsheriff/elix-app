import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { isAdministrator } from '../../lib/staffPermissions';
import { useElixHealthStaff } from './ElixHealthStaffContext';
import { ELIX_HEALTH_PATHS } from './elixHealthRoutes';

export function AdministratorOnly({ children }: { children: ReactNode }) {
  const staff = useElixHealthStaff();
  if (!isAdministrator(staff)) {
    return <Navigate to={ELIX_HEALTH_PATHS.overview} replace />;
  }
  return children;
}

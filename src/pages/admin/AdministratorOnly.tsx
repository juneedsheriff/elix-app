import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { isAdministrator } from '../../lib/staffPermissions';
import { useElixHealthStaff } from './ElixHealthStaffContext';
import { staffLandingPath } from './elixHealthRoutes';

export function AdministratorOnly({ children }: { children: ReactNode }) {
  const { staff } = useElixHealthStaff();
  if (!isAdministrator(staff)) {
    return <Navigate to={staffLandingPath(staff.role)} replace />;
  }
  return children;
}

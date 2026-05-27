import { createContext, useContext } from 'react';
import type { Admin } from '../../types/admin';

export const ElixHealthStaffContext = createContext<Admin | null>(null);

export function useElixHealthStaff(): Admin {
  const admin = useContext(ElixHealthStaffContext);
  if (!admin) {
    throw new Error('useElixHealthStaff must be used within ElixHealthStaffContext');
  }
  return admin;
}

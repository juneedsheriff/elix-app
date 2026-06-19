import { createContext, useContext } from 'react';
import type { Admin } from '../../types/admin';

export type ElixHealthStaffContextValue = {
  staff: Admin;
  refreshStaff: () => Promise<void>;
};

export const ElixHealthStaffContext = createContext<ElixHealthStaffContextValue | null>(null);

export function useElixHealthStaff(): ElixHealthStaffContextValue {
  const value = useContext(ElixHealthStaffContext);
  if (!value) {
    throw new Error('useElixHealthStaff must be used within ElixHealthStaffContext');
  }
  return value;
}

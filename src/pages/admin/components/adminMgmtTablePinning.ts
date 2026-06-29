/** Shared MRT config: keep the actions column pinned to the right while scrolling. */
export const ADMIN_MGMT_ACTIONS_COLUMN_ID = 'actions';

export const adminMgmtTableColumnPinning = {
  right: [ADMIN_MGMT_ACTIONS_COLUMN_ID]
} as const;

export const adminMgmtTablePinningOptions = {
  enableColumnPinning: true
};

/** Gym flexible-expense permission keys (mirrors backend catalog). */
export const EXPENSE_PERMISSION_KEYS = {
  read: 'gym.expenses.read',
  manage: 'gym.expenses.manage',
  delete: 'gym.expenses.delete',
  pnlRead: 'gym.financialReports.read',
} as const;

/** Fallback catalog when backend omits Expenses group. */
export const EXPENSE_TEAM_PERMISSION_DEFS = [
  {
    key: EXPENSE_PERMISSION_KEYS.read,
    label: 'View expenses',
    description: 'View expense ledger and expense heads',
    group: 'Expenses',
  },
  {
    key: EXPENSE_PERMISSION_KEYS.manage,
    label: 'Manage expenses',
    description: 'Create and edit expense entries and expense heads',
    group: 'Expenses',
  },
  {
    key: EXPENSE_PERMISSION_KEYS.delete,
    label: 'Delete expenses',
    description: 'Delete expense entries and deactivate expense heads',
    group: 'Expenses',
  },
] as const;

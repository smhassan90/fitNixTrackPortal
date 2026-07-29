/** Gym employee + employee-attendance permission keys. */
export const EMPLOYEE_PERMISSION_KEYS = {
  read: 'gym.employees.read',
  manage: 'gym.employees.manage',
  delete: 'gym.employees.delete',
  attendanceRead: 'gym.employeeAttendance.read',
  attendanceManage: 'gym.employeeAttendance.manage',
} as const;

/** Fallback catalog when backend omits Employees group. */
export const EMPLOYEE_TEAM_PERMISSION_DEFS = [
  {
    key: EMPLOYEE_PERMISSION_KEYS.read,
    label: 'View employees',
    description: 'View gym employee roster',
    group: 'Employees',
  },
  {
    key: EMPLOYEE_PERMISSION_KEYS.manage,
    label: 'Manage employees',
    description: 'Create, edit, activate, and deactivate employees',
    group: 'Employees',
  },
  {
    key: EMPLOYEE_PERMISSION_KEYS.delete,
    label: 'Delete employees',
    description: 'Permanently delete employees and their attendance',
    group: 'Employees',
  },
  {
    key: EMPLOYEE_PERMISSION_KEYS.attendanceRead,
    label: 'View employee attendance',
    description: 'View daily employee attendance and history',
    group: 'Employees',
  },
  {
    key: EMPLOYEE_PERMISSION_KEYS.attendanceManage,
    label: 'Manage employee attendance',
    description: 'Mark Present / Late / Absent and notes (check-in/out times come from devices only)',
    group: 'Employees',
  },
] as const;

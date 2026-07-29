/** Gym roles that may manage day-to-day gym data (members, packages, trainers, payments). */
const GYM_MANAGER_ROLES = new Set(['GYM_ADMIN', 'GYM_MANAGER']);

export function normalizeGymRole(role?: string | null): string {
  return String(role ?? '')
    .trim()
    .toUpperCase();
}

export function canManageGymPayments(role?: string | null): boolean {
  return GYM_MANAGER_ROLES.has(normalizeGymRole(role));
}

/** Add, update, delete members, packages, and trainers. */
export function canManageGymCatalog(role?: string | null): boolean {
  return GYM_MANAGER_ROLES.has(normalizeGymRole(role));
}

export function isGymAdmin(role?: string | null): boolean {
  return normalizeGymRole(role) === 'GYM_ADMIN';
}

/** Minimal user shape for permission checks. */
export type GymPermissionUser = {
  role?: string | null;
  permissionKeys?: string[] | null;
  usesLegacyPermissions?: boolean | null;
};

/**
 * Client-side implied permission expansion (mirrors backend).
 * manage ⇒ read; delete ⇒ manage + read; plus a few cross-resource reads.
 */
export function expandPermissionKeys(keys: Iterable<string>): Set<string> {
  const set = new Set(Array.from(keys).filter(Boolean));

  const imply = (from: string, ...to: string[]) => {
    if (!set.has(from)) return;
    for (const k of to) set.add(k);
  };

  // Run a few passes so delete → manage → read chains settle.
  for (let i = 0; i < 3; i++) {
    imply('gym.members.delete', 'gym.members.manage', 'gym.members.read');
    imply('gym.members.manage', 'gym.members.read');
    imply('gym.trainers.delete', 'gym.trainers.manage', 'gym.trainers.read');
    imply('gym.trainers.manage', 'gym.trainers.read');
    imply('gym.employees.delete', 'gym.employees.manage', 'gym.employees.read');
    imply('gym.employees.manage', 'gym.employees.read');
    imply(
      'gym.employeeAttendance.manage',
      'gym.employeeAttendance.read',
      'gym.employees.read'
    );
    imply('gym.employeeAttendance.read', 'gym.employees.read');
    imply('gym.packages.manage', 'gym.packages.read');
    imply('gym.packageFeatures.manage', 'gym.packages.read');
    imply('gym.payments.delete', 'gym.payments.manage', 'gym.payments.read');
    imply('gym.payments.manage', 'gym.payments.read');
    imply('gym.pos.products.manage', 'gym.pos.catalog.read');
    imply('gym.pos.inventory.manage', 'gym.pos.catalog.read');
    imply('gym.pos.sell', 'gym.pos.catalog.read');
    imply('gym.devices.manage', 'gym.devices.read');
    imply('gym.settings.manage', 'gym.settings.read');
  }

  return set;
}

/** When legacy role access is still active and keys are empty, approximate prior UI access. */
const LEGACY_MANAGER_KEYS = [
  'gym.dashboard.read',
  'gym.financialReports.read',
  'gym.members.read',
  'gym.members.manage',
  'gym.members.delete',
  'gym.trainers.read',
  'gym.trainers.manage',
  'gym.trainers.delete',
  'gym.employees.read',
  'gym.employees.manage',
  'gym.employees.delete',
  'gym.employeeAttendance.read',
  'gym.employeeAttendance.manage',
  'gym.packages.read',
  'gym.packages.manage',
  'gym.payments.read',
  'gym.payments.manage',
  'gym.payments.delete',
  'gym.attendancePolicy.manage',
  'gym.devices.read',
  'gym.devices.manage',
  'gym.settings.read',
] as const;

const LEGACY_STAFF_KEYS = [
  'gym.dashboard.read',
  'gym.members.read',
  'gym.trainers.read',
  'gym.employees.read',
  'gym.employeeAttendance.read',
  'gym.packages.read',
  'gym.payments.read',
  'gym.devices.read',
  'gym.settings.read',
] as const;

function resolveEffectiveKeys(user: GymPermissionUser): Set<string> {
  const raw = Array.isArray(user.permissionKeys)
    ? user.permissionKeys.filter((k): k is string => typeof k === 'string' && k.length > 0)
    : [];

  if (raw.length > 0) {
    return expandPermissionKeys(raw);
  }

  if (user.usesLegacyPermissions) {
    const role = normalizeGymRole(user.role);
    if (role === 'GYM_MANAGER') return expandPermissionKeys(LEGACY_MANAGER_KEYS);
    return expandPermissionKeys(LEGACY_STAFF_KEYS);
  }

  return expandPermissionKeys(raw);
}

/**
 * Whether the user can perform the given permission key.
 * GYM_ADMIN always has full access. Otherwise checks effective permissionKeys
 * (with client-side implication expansion).
 */
export function canGymPermission(
  user: GymPermissionUser | null | undefined,
  key: string
): boolean {
  if (!user || !key) return false;
  if (isGymAdmin(user.role)) return true;
  return resolveEffectiveKeys(user).has(key);
}

/** Normalize permissionKeys from API payloads. */
export function normalizePermissionKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((k) => (typeof k === 'string' ? k.trim() : ''))
    .filter(Boolean);
}

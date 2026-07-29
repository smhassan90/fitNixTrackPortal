import api from '@/lib/api';

export type GymPermissionDefinition = {
  key: string;
  label: string;
  description?: string;
  group?: string;
};

export type GymAlwaysAvailablePermission = {
  key: string;
  label: string;
  description?: string;
};

export type GymPermissionsCatalog = {
  permissions: GymPermissionDefinition[];
  alwaysAvailable: GymAlwaysAvailablePermission[];
};

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function pickString(v: unknown): string {
  if (v == null) return '';
  const s = String(v).trim();
  return s && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined' ? s : '';
}

function normalizePermission(row: unknown): GymPermissionDefinition | null {
  const o = asObj(row);
  if (!o) return null;
  const key = pickString(o.key);
  if (!key) return null;
  // Import is admin-only one-time — never show as a checkbox even if catalog drifts.
  if (key.includes('import') || /import/i.test(pickString(o.label))) return null;
  return {
    key,
    label: pickString(o.label) || key,
    description: pickString(o.description) || undefined,
    group: pickString(o.group) || 'General',
  };
}

function normalizeAlwaysAvailable(row: unknown): GymAlwaysAvailablePermission | null {
  const o = asObj(row);
  if (!o) return null;
  const key = pickString(o.key);
  if (!key) return null;
  return {
    key,
    label: pickString(o.label) || key,
    description: pickString(o.description) || undefined,
  };
}

function unwrapCatalog(body: unknown): GymPermissionsCatalog {
  const root = asObj(body);
  const data = asObj(root?.data) ?? root;
  const permissionsRaw = Array.isArray(data?.permissions)
    ? data!.permissions
    : Array.isArray(root?.permissions)
      ? root!.permissions
      : [];
  const alwaysRaw = Array.isArray(data?.alwaysAvailable)
    ? data!.alwaysAvailable
    : Array.isArray(root?.alwaysAvailable)
      ? root!.alwaysAvailable
      : [];

  return {
    permissions: permissionsRaw
      .map((row) => normalizePermission(row))
      .filter((p): p is GymPermissionDefinition => p != null),
    alwaysAvailable: alwaysRaw
      .map((row) => normalizeAlwaysAvailable(row))
      .filter((p): p is GymAlwaysAvailablePermission => p != null),
  };
}

/** GET /api/gym/permissions — catalog for team permission checkboxes. */
export async function fetchGymPermissionsCatalog(): Promise<GymPermissionsCatalog> {
  const res = await api.get('/api/gym/permissions');
  if (!res.data?.success && res.data?.permissions == null && res.data?.data == null) {
    throw new Error(res.data?.error?.message || 'Failed to load permissions catalog');
  }
  // Support both { success, data: { permissions } } and bare { permissions }.
  const body = res.data?.success !== undefined ? res.data : { data: res.data };
  return unwrapCatalog(body);
}

/**
 * Toggle a permission key with cascade UX:
 * - selecting delete → also manage + read
 * - selecting manage → also read
 * - unchecking read → also unchecks manage + delete
 */
export function togglePermissionKeyWithCascade(
  current: string[],
  key: string,
  allKeys: string[]
): string[] {
  const set = new Set(current);
  const checked = !set.has(key);

  const resourcePrefix = key.replace(/\.(read|manage|delete)$/, '');
  const readKey = `${resourcePrefix}.read`;
  const manageKey = `${resourcePrefix}.manage`;
  const deleteKey = `${resourcePrefix}.delete`;
  const hasRead = allKeys.includes(readKey);
  const hasManage = allKeys.includes(manageKey);
  const hasDelete = allKeys.includes(deleteKey);

  if (checked) {
    set.add(key);
    if (key.endsWith('.delete')) {
      if (hasManage) set.add(manageKey);
      if (hasRead) set.add(readKey);
    } else if (key.endsWith('.manage')) {
      if (hasRead) set.add(readKey);
    }
    // Employee attendance manage also needs employee roster read
    if (key === 'gym.employeeAttendance.manage' || key === 'gym.employeeAttendance.read') {
      if (allKeys.includes('gym.employees.read')) set.add('gym.employees.read');
    }
  } else {
    set.delete(key);
    if (key.endsWith('.read')) {
      if (hasManage) set.delete(manageKey);
      if (hasDelete) set.delete(deleteKey);
    } else if (key.endsWith('.manage')) {
      if (hasDelete) set.delete(deleteKey);
    }
  }

  return Array.from(set);
}

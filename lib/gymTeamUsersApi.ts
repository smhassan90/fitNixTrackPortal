import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errorHandler';
import { normalizePermissionKeys } from '@/lib/gymRoles';

/** Must align with backend gym-scoped user roles. */
export const GYM_TEAM_ROLE_OPTIONS = [
  { value: 'GYM_STAFF', label: 'Staff' },
  { value: 'GYM_MANAGER', label: 'Manager' },
  { value: 'GYM_ADMIN', label: 'Administrator' },
] as const;

export type GymTeamUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  permissionKeys: string[];
  usesLegacyPermissions: boolean;
  isActive: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
};

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function pickString(v: unknown): string {
  if (v == null) return '';
  const s = String(v).trim();
  return s && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined' ? s : '';
}

export function normalizeGymTeamUser(row: unknown): GymTeamUser | null {
  const o = asObj(row);
  if (!o) return null;
  const id = pickString(o.id);
  if (!id) return null;
  return {
    id,
    name: pickString(o.name) || '—',
    email: pickString(o.email) || '—',
    phone: o.phone != null ? pickString(o.phone) : null,
    role: pickString(o.role) || 'GYM_STAFF',
    permissionKeys: normalizePermissionKeys(o.permissionKeys),
    usesLegacyPermissions: o.usesLegacyPermissions === true,
    isActive: o.isActive === false || pickString(o.status) === 'INACTIVE' ? false : true,
    createdAt: o.createdAt != null ? pickString(o.createdAt) : undefined,
    lastLoginAt: o.lastLoginAt != null && pickString(o.lastLoginAt) ? pickString(o.lastLoginAt) : null,
  };
}

function unwrapList(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const root = asObj(body);
  if (!root) return [];
  if (Array.isArray(root.users)) return root.users;
  if (Array.isArray(root.items)) return root.items;
  if (Array.isArray(root.data)) {
    const inner = root.data;
    if (Array.isArray(inner)) return inner;
    const d = asObj(Array.isArray(inner) ? null : root.data);
    if (d && Array.isArray(d.users)) return d.users;
  }
  const d = asObj(root.data);
  if (d && Array.isArray(d.users)) return d.users;
  return [];
}

export async function fetchGymTeamUsers(): Promise<GymTeamUser[]> {
  const res = await api.get('/api/gym/users');
  if (!res.data?.success) {
    throw new Error(res.data?.error?.message || 'Failed to load team users');
  }
  return unwrapList(res.data.data)
    .map((row) => normalizeGymTeamUser(row))
    .filter((r): r is GymTeamUser => r != null);
}

export type CreateGymTeamUserInput = {
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  /** If omitted, backend may generate and return temporaryPassword. */
  password?: string;
  /** Checked permission keys. Defaults to [] if omitted. Admins should send []. */
  permissionKeys?: string[];
};

export type CreateGymTeamUserResult = {
  user: GymTeamUser;
  temporaryPassword?: string;
};

export async function createGymTeamUser(
  input: CreateGymTeamUserInput
): Promise<CreateGymTeamUserResult> {
  const res = await api.post('/api/gym/users', input);
  if (!res.data?.success) {
    throw new Error(res.data?.error?.message || 'Failed to create user');
  }
  const data = asObj(res.data.data);
  const u = data?.user ?? res.data.data;
  const user = normalizeGymTeamUser(u) ?? null;
  if (!user) throw new Error('Invalid response from server');
  const temp =
    data && typeof data.temporaryPassword === 'string' ? data.temporaryPassword : undefined;
  return { user, temporaryPassword: temp };
}

export type UpdateGymTeamUserInput = {
  name?: string;
  email?: string;
  phone?: string | null;
  role?: string;
  isActive?: boolean;
  password?: string;
  /** Omit to leave unchanged. */
  permissionKeys?: string[];
};

export async function updateGymTeamUser(
  id: string | number,
  input: UpdateGymTeamUserInput
): Promise<GymTeamUser> {
  const res = await api.patch(`/api/gym/users/${id}`, input);
  if (!res.data?.success) {
    throw new Error(res.data?.error?.message || 'Failed to update user');
  }
  const u = asObj(res.data.data)?.user ?? res.data.data;
  return normalizeGymTeamUser(u) ?? ({} as GymTeamUser);
}

export async function removeGymTeamUser(id: string | number): Promise<void> {
  const res = await api.delete(`/api/gym/users/${id}`);
  if (res.status === 204 || res.data?.success === true) return;
  throw new Error(res.data?.error?.message || 'Failed to remove user');
}

export function toUserMessage(e: unknown): string {
  return getErrorMessage(e);
}

import api from '@/lib/api';
import { normalizeMemberNumberFields } from '@/lib/displayMemberId';

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

export interface AttendanceDevice {
  id: number | string;
  name: string;
  ipAddress?: string | null;
  deviceConfigId?: string | null;
  lastSyncAt?: string | null;
  isActive?: boolean;
}

export interface TabletSyncSetup {
  apiKey: string;
  devices: AttendanceDevice[];
}

function normalizeDevice(row: unknown): AttendanceDevice | null {
  const o = asObj(row);
  if (!o || o.id == null) return null;
  return {
    id: typeof o.id === 'number' ? o.id : String(o.id),
    name: String(o.name ?? `Device ${o.id}`),
    ipAddress: o.ipAddress != null ? String(o.ipAddress) : null,
    deviceConfigId: o.deviceConfigId != null ? String(o.deviceConfigId) : null,
    lastSyncAt: o.lastSyncAt != null ? String(o.lastSyncAt) : null,
    isActive: o.isActive !== false,
  };
}

export function normalizeTabletSyncSetup(raw: unknown): TabletSyncSetup {
  const o = asObj(raw) ?? {};
  const devices = (Array.isArray(o.devices) ? o.devices : [])
    .map(normalizeDevice)
    .filter((d): d is AttendanceDevice => d != null);

  return {
    apiKey: String(o.apiKey ?? o.tabletApiKey ?? ''),
    devices,
  };
}

export async function fetchTabletSyncSetup(): Promise<TabletSyncSetup> {
  const res = await api.get('/api/device/tablet-sync-setup');
  if (!res.data?.success) {
    throw new Error(res.data?.error?.message || 'Failed to load device setup');
  }
  return normalizeTabletSyncSetup(res.data.data);
}

export type AddAttendanceDeviceInput = {
  name: string;
  ipAddress: string;
};

export function isValidDeviceIpAddress(ip: string): boolean {
  const trimmed = ip.trim();
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) return false;
  return trimmed.split('.').every((octet) => {
    const n = Number(octet);
    return n >= 0 && n <= 255;
  });
}

export async function addAttendanceDevice(input: AddAttendanceDeviceInput): Promise<AttendanceDevice> {
  const res = await api.post('/api/device', {
    name: input.name.trim(),
    ipAddress: input.ipAddress.trim(),
  });
  if (!res.data?.success) {
    throw new Error(res.data?.error?.message || 'Failed to add device');
  }
  const device = normalizeDevice(res.data.data?.device ?? res.data.data);
  if (!device) throw new Error('Invalid device response');
  return device;
}

export type MappingCandidate = {
  deviceUserId: string;
  deviceUserName: string | null;
  deviceBadgeId: string | null;
  pendingLogCount: number;
  suggestedMember: { id: number; name: string; memberNumber: string | null; legacyMemberId: string | null } | null;
  matchType: 'exact' | null;
};

export type UnmappedMember = {
  id: number;
  memberNumber: string | null;
  legacyMemberId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
};

export type MappingCandidatesResponse = {
  unmappedDeviceUsers: MappingCandidate[];
  unmappedMembers: UnmappedMember[];
  mappedCount: number;
  pendingLogCount: number;
};

export type ConfirmMappingsBody = {
  mappings: Array<{ deviceUserId: string; memberId: number }>;
};

export type ConfirmMappingsResult = {
  mapped: number;
  attendanceSynced: number;
  errors: string[];
  message: string;
};

export type SyncUsersResult = {
  unmappedCount: number;
  message?: string;
};

export type SyncAttendanceResult = {
  pending: number;
  message?: string;
};

function devicePath(deviceId: number | string): string {
  return `/api/device/${encodeURIComponent(String(deviceId))}`;
}

function normalizeSuggestedMember(
  raw: unknown
): { id: number; name: string; memberNumber: string | null; legacyMemberId: string | null } | null {
  const o = asObj(raw);
  if (!o || o.id == null) return null;
  const id = Number(o.id);
  if (!Number.isFinite(id)) return null;
  const nums = normalizeMemberNumberFields(o);
  return {
    id,
    name: String(o.name ?? `Member ${id}`),
    memberNumber: nums.memberNumber,
    legacyMemberId: nums.legacyMemberId,
  };
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const v of values) {
    if (v != null && v !== '') return String(v);
  }
  return null;
}

function normalizeMappingCandidate(raw: unknown): MappingCandidate | null {
  const o = asObj(raw);
  if (!o || o.deviceUserId == null) return null;
  const suggestedMember = normalizeSuggestedMember(o.suggestedMember);
  const matchType = o.matchType === 'exact' && suggestedMember ? 'exact' : null;
  return {
    deviceUserId: String(o.deviceUserId),
    // Backend field naming varies across device firmwares; accept common variants.
    deviceUserName: firstNonEmptyString(
      o.deviceUserName,
      o.deviceUsername,
      o.userName,
      o.username,
      o.name,
      o.fullName
    ),
    deviceBadgeId: o.deviceBadgeId != null && o.deviceBadgeId !== '' ? String(o.deviceBadgeId) : null,
    pendingLogCount: Number(o.pendingLogCount ?? 0) || 0,
    suggestedMember: matchType === 'exact' ? suggestedMember : null,
    matchType,
  };
}

function normalizeUnmappedMember(raw: unknown): UnmappedMember | null {
  const o = asObj(raw);
  if (!o || o.id == null) return null;
  const id = Number(o.id);
  if (!Number.isFinite(id)) return null;
  const nums = normalizeMemberNumberFields(o);
  return {
    id,
    memberNumber: nums.memberNumber,
    legacyMemberId: nums.legacyMemberId,
    name: String(o.name ?? `Member ${id}`),
    email: o.email != null ? String(o.email) : null,
    phone: o.phone != null ? String(o.phone) : null,
  };
}

export function normalizeMappingCandidates(raw: unknown): MappingCandidatesResponse {
  const o = asObj(raw) ?? {};
  return {
    unmappedDeviceUsers: (Array.isArray(o.unmappedDeviceUsers) ? o.unmappedDeviceUsers : [])
      .map(normalizeMappingCandidate)
      .filter((c): c is MappingCandidate => c != null),
    unmappedMembers: (Array.isArray(o.unmappedMembers) ? o.unmappedMembers : [])
      .map(normalizeUnmappedMember)
      .filter((m): m is UnmappedMember => m != null),
    mappedCount: Number(o.mappedCount ?? 0) || 0,
    pendingLogCount: Number(o.pendingLogCount ?? 0) || 0,
  };
}

export async function fetchMappingCandidates(
  deviceId: number | string
): Promise<MappingCandidatesResponse> {
  const res = await api.get(`${devicePath(deviceId)}/mapping-candidates`);
  if (!res.data?.success) {
    throw new Error(res.data?.error?.message || 'Failed to load mapping candidates');
  }
  return normalizeMappingCandidates(res.data.data);
}

export async function confirmDeviceMappings(
  deviceId: number | string,
  mappings: ConfirmMappingsBody['mappings']
): Promise<ConfirmMappingsResult> {
  const res = await api.post(`${devicePath(deviceId)}/mappings/confirm`, { mappings });
  if (!res.data?.success) {
    throw new Error(res.data?.error?.message || 'Failed to confirm mappings');
  }
  const o = asObj(res.data.data) ?? {};
  const errors = Array.isArray(o.errors)
    ? o.errors.map((e) => String(e))
    : [];
  return {
    mapped: Number(o.mapped ?? 0) || 0,
    attendanceSynced: Number(o.attendanceSynced ?? 0) || 0,
    errors,
    message: String(o.message ?? res.data.message ?? ''),
  };
}

export async function syncDeviceUsers(deviceId: number | string): Promise<SyncUsersResult> {
  const res = await api.post(`${devicePath(deviceId)}/sync-users`);
  if (!res.data?.success) {
    throw new Error(res.data?.error?.message || 'Failed to sync device users');
  }
  const o = asObj(res.data.data) ?? {};
  return {
    unmappedCount: Number(o.unmappedCount ?? 0) || 0,
    message: typeof o.message === 'string' ? o.message : res.data.message,
  };
}

export async function syncDeviceAttendance(deviceId: number | string): Promise<SyncAttendanceResult> {
  const res = await api.post(`${devicePath(deviceId)}/sync-attendance`);
  if (!res.data?.success) {
    throw new Error(res.data?.error?.message || 'Failed to sync attendance');
  }
  const o = asObj(res.data.data) ?? {};
  return {
    pending: Number(o.pending ?? 0) || 0,
    message: typeof o.message === 'string' ? o.message : res.data.message,
  };
}

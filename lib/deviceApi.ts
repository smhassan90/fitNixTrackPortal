import api from '@/lib/api';

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

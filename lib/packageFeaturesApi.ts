import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errorHandler';

export type PackageFeature = {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CreatePackageFeatureInput = {
  name: string;
  code?: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
};

export type UpdatePackageFeatureInput = {
  name?: string;
  code?: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
};

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function pickString(v: unknown): string {
  if (v == null) return '';
  const s = String(v).trim();
  return s && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined' ? s : '';
}

export function normalizePackageFeature(row: unknown): PackageFeature | null {
  const o = asObj(row);
  if (!o) return null;
  const id = Number(o.id ?? o.featureId);
  const name = pickString(o.name ?? o.featureName ?? o.label);
  if (!Number.isFinite(id) || !name) return null;
  const codeRaw = pickString(o.code);
  const descRaw = pickString(o.description);
  return {
    id,
    name,
    code: codeRaw || null,
    description: descRaw || null,
    isActive: o.isActive !== false,
    sortOrder: Number.isFinite(Number(o.sortOrder)) ? Number(o.sortOrder) : 0,
    createdAt: pickString(o.createdAt),
    updatedAt: pickString(o.updatedAt),
  };
}

function unwrapFeatures(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const root = asObj(body);
  if (!root) return [];
  if (Array.isArray(root.features)) return root.features;
  if (Array.isArray(root.items)) return root.items;
  const data = asObj(root.data);
  if (data) {
    if (Array.isArray(data.features)) return data.features;
    if (Array.isArray(data.items)) return data.items;
  }
  if (Array.isArray(root.data)) return root.data;
  return [];
}

function unwrapFeature(body: unknown): unknown {
  const root = asObj(body);
  if (!root) return body;
  const data = asObj(root.data);
  if (data?.feature != null) return data.feature;
  if (root.feature != null) return root.feature;
  if (data && !Array.isArray(data) && data.id != null) return data;
  return root.data ?? body;
}

export function normalizeFeaturesList(payload: unknown): PackageFeature[] {
  return unwrapFeatures(payload)
    .map(normalizePackageFeature)
    .filter((f): f is PackageFeature => f != null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

/** Active features for package create/edit checkboxes. */
export async function fetchActivePackageFeatures(): Promise<PackageFeature[]> {
  const res = await api.get('/api/packages/features');
  if (res.data?.success === false) {
    throw new Error(res.data?.error?.message || 'Failed to load package features');
  }
  return normalizeFeaturesList(res.data);
}

/** Full catalog for GYM_ADMIN management (`?all=true`). */
export async function fetchAllPackageFeatures(): Promise<PackageFeature[]> {
  const res = await api.get('/api/packages/features', { params: { all: true } });
  if (res.data?.success === false) {
    throw new Error(res.data?.error?.message || 'Failed to load package features');
  }
  return normalizeFeaturesList(res.data);
}

export async function createPackageFeature(
  input: CreatePackageFeatureInput
): Promise<PackageFeature> {
  const res = await api.post('/api/packages/features', input);
  if (!res.data?.success) {
    throw Object.assign(new Error(res.data?.error?.message || 'Failed to create feature'), {
      response: { status: res.status, data: res.data },
    });
  }
  const feature = normalizePackageFeature(unwrapFeature(res.data));
  if (!feature) throw new Error('Invalid feature response');
  return feature;
}

export async function updatePackageFeature(
  id: number | string,
  input: UpdatePackageFeatureInput
): Promise<PackageFeature> {
  const res = await api.patch(`/api/packages/features/${encodeURIComponent(String(id))}`, input);
  if (!res.data?.success) {
    throw Object.assign(new Error(res.data?.error?.message || 'Failed to update feature'), {
      response: { status: res.status, data: res.data },
    });
  }
  const feature = normalizePackageFeature(unwrapFeature(res.data));
  if (!feature) throw new Error('Invalid feature response');
  return feature;
}

export async function deletePackageFeature(id: number | string): Promise<void> {
  const res = await api.delete(`/api/packages/features/${encodeURIComponent(String(id))}`);
  if (!res.data?.success) {
    throw Object.assign(new Error(res.data?.error?.message || 'Failed to delete feature'), {
      response: { status: res.status, data: res.data },
    });
  }
}

/** Prefer API error body (FEATURE_IN_USE, VALIDATION_ERROR details, 409 duplicates). */
export function packageFeatureErrorMessage(err: unknown): string {
  const axiosErr = err as {
    response?: { status?: number; data?: { error?: { code?: string; message?: string } } };
  };
  const status = axiosErr.response?.status;
  const code = axiosErr.response?.data?.error?.code;
  if (code === 'FEATURE_IN_USE' || (status === 409 && /in.?use/i.test(String(axiosErr.response?.data?.error?.message ?? '')))) {
    return 'Unassign this feature from packages first.';
  }
  if (status === 409) {
    return getErrorMessage(err) || 'A feature with this name or code already exists.';
  }
  return getErrorMessage(err as object);
}

/** Optional code: uppercase A–Z, 0–9, underscore. */
export function sanitizeFeatureCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '')
    .slice(0, 64);
}

export function isValidFeatureCode(code: string): boolean {
  if (!code) return true;
  return /^[A-Z0-9_]+$/.test(code);
}

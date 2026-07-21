import platformClient, { assertPlatformSuccess } from './platformClient';
import type { PlatformApiEnvelope } from './types';
import { normalizeAnalyticsRows, normalizeCategory } from '@/lib/pos/posApi';
import type { PosAnalyticsRow, PosCategory, NutrientForm, PosProductType } from '@/lib/pos/types';

function unwrapList(body: unknown, keys: string[]): unknown[] {
  if (Array.isArray(body)) return body;
  const root = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  if (!root) return [];
  for (const k of keys) {
    if (Array.isArray(root[k])) return root[k] as unknown[];
  }
  const data = root.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    for (const k of keys) {
      if (Array.isArray(d[k])) return d[k] as unknown[];
    }
  }
  return [];
}

// ─── Platform catalog CRUD ─────────────────────────────────────────────────

export async function fetchPlatformPosCatalog(productType?: PosProductType): Promise<PosCategory[]> {
  const res = await platformClient.get<PlatformApiEnvelope<unknown>>('/api/platform/pos/catalog', {
    params: productType ? { productType } : undefined,
  });
  const data = assertPlatformSuccess(res);
  const list = unwrapList(data, ['categories', 'catalog']);
  return list.map(normalizeCategory).filter((c): c is PosCategory => c != null);
}

export async function createPlatformPosCategory(body: {
  name: string;
  productType: PosProductType;
  sortOrder?: number;
}): Promise<PosCategory> {
  const res = await platformClient.post<PlatformApiEnvelope<unknown>>('/api/platform/pos/categories', body);
  const data = assertPlatformSuccess(res);
  const row = (data as Record<string, unknown>)?.category ?? data;
  const cat = normalizeCategory(row);
  if (!cat) throw new Error('Invalid category response');
  return cat;
}

export async function updatePlatformPosCategory(
  id: number | string,
  body: Partial<{ name: string; sortOrder: number }>
): Promise<PosCategory> {
  const res = await platformClient.patch<PlatformApiEnvelope<unknown>>(
    `/api/platform/pos/categories/${id}`,
    body
  );
  const data = assertPlatformSuccess(res);
  const row = (data as Record<string, unknown>)?.category ?? data;
  const cat = normalizeCategory(row);
  if (!cat) throw new Error('Invalid category response');
  return cat;
}

export async function deletePlatformPosCategory(id: number | string): Promise<void> {
  const res = await platformClient.delete<PlatformApiEnvelope<unknown>>(`/api/platform/pos/categories/${id}`);
  assertPlatformSuccess(res);
}

export async function createPlatformPosSubcategory(body: {
  categoryId: number;
  name: string;
  allowedForms?: NutrientForm[];
  sortOrder?: number;
}): Promise<void> {
  const res = await platformClient.post<PlatformApiEnvelope<unknown>>('/api/platform/pos/subcategories', body);
  assertPlatformSuccess(res);
}

export async function updatePlatformPosSubcategory(
  id: number | string,
  body: Partial<{ name: string; allowedForms: NutrientForm[]; sortOrder: number }>
): Promise<void> {
  const res = await platformClient.patch<PlatformApiEnvelope<unknown>>(
    `/api/platform/pos/subcategories/${id}`,
    body
  );
  assertPlatformSuccess(res);
}

export async function deletePlatformPosSubcategory(id: number | string): Promise<void> {
  const res = await platformClient.delete<PlatformApiEnvelope<unknown>>(`/api/platform/pos/subcategories/${id}`);
  assertPlatformSuccess(res);
}

// ─── Platform analytics ────────────────────────────────────────────────────

export async function fetchPlatformPosAnalytics(params: Record<string, string | number | undefined>): Promise<PosAnalyticsRow[]> {
  const res = await platformClient.get<PlatformApiEnvelope<unknown>>('/api/platform/pos/analytics', { params });
  const data = assertPlatformSuccess(res);
  return normalizeAnalyticsRows(data);
}

export async function comparePlatformGymsByCategory(
  categoryId: number | string,
  params?: Record<string, string | undefined>
): Promise<PosAnalyticsRow[]> {
  const res = await platformClient.get<PlatformApiEnvelope<unknown>>(
    `/api/platform/pos/analytics/compare-gyms/category/${categoryId}`,
    { params }
  );
  const data = assertPlatformSuccess(res);
  return normalizeAnalyticsRows(data);
}

export async function listPlatformGymsForPos(): Promise<Array<{ id: number; name: string }>> {
  const res = await platformClient.get<PlatformApiEnvelope<unknown>>('/api/platform/gyms', {
    params: { page: 1, limit: 500 },
  });
  const data = assertPlatformSuccess(res) as Record<string, unknown>;
  const gyms = Array.isArray(data.gyms) ? data.gyms : Array.isArray(data.items) ? data.items : [];
  return gyms.map((g) => {
    const o = g && typeof g === 'object' ? (g as Record<string, unknown>) : null;
    if (!o) return null;
    const id = Number(o.id);
    if (!id) return null;
    return { id, name: String(o.name ?? '—') };
  }).filter((g): g is { id: number; name: string } => g != null);
}

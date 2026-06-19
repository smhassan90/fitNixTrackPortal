/** Fee collection ledger rows from GET /api/dashboard/stats and fee-collections endpoints. */

import type { AxiosInstance } from 'axios';

export type FeeCollectionCategory = 'MONTHLY_FEE' | 'SIGNUP_FEE' | 'ADMISSION_ONLY';
export type FeeCollectionSourceType = 'MONTHLY_PAYMENT' | 'ONE_TIME_PAYMENT';

export interface FeeCollectionRow {
  id: number;
  memberId: number;
  memberName: string;
  amount: number;
  collectedAt: string;
  billingMonth: string | null;
  category: FeeCollectionCategory;
  description: string;
  sourceType: FeeCollectionSourceType;
  sourceId: number;
}

export interface FeeCollectionsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface FeeCollectionsQuery {
  startDate?: string;
  endDate?: string;
  billingMonth?: string;
  category?: FeeCollectionCategory;
  page?: number;
  limit?: number;
}

export interface FeeCollectionsResult {
  gymId?: number;
  collections: FeeCollectionRow[];
  pagination: FeeCollectionsPagination;
  gymMismatch: string | null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

export function gymIdsMatch(
  a: unknown,
  b: string | number | null | undefined
): boolean {
  if (a == null || b == null) return true;
  return String(a) === String(b);
}

export function assertResponseGymId(
  responseGymId: unknown,
  expectedGymId: string | number | null | undefined
): string | null {
  if (responseGymId == null || expectedGymId == null) return null;
  if (!gymIdsMatch(responseGymId, expectedGymId)) {
    return `Ledger data is for gym ${responseGymId}, but you are logged into gym ${expectedGymId}.`;
  }
  return null;
}

export function normalizeFeeCollectionRow(raw: unknown): FeeCollectionRow | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = Number(row.id);
  const memberId = Number(row.memberId);
  const sourceId = Number(row.sourceId);
  if (!id || Number.isNaN(id)) return null;
  const category = String(row.category ?? 'MONTHLY_FEE') as FeeCollectionCategory;
  const sourceType = String(row.sourceType ?? 'MONTHLY_PAYMENT') as FeeCollectionSourceType;
  return {
    id,
    memberId: Number.isNaN(memberId) ? 0 : memberId,
    memberName: String(row.memberName ?? ''),
    amount: Number(row.amount) || 0,
    collectedAt: String(row.collectedAt ?? ''),
    billingMonth: row.billingMonth != null ? String(row.billingMonth) : null,
    category,
    description: String(row.description ?? ''),
    sourceType,
    sourceId: Number.isNaN(sourceId) ? id : sourceId,
  };
}

export function normalizeRecentCollections(raw: unknown): FeeCollectionRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeFeeCollectionRow)
    .filter((row): row is FeeCollectionRow => row != null);
}

export function categoryLabel(category: FeeCollectionCategory | string): string {
  switch (category) {
    case 'SIGNUP_FEE':
      return 'Signup';
    case 'ADMISSION_ONLY':
      return 'Admission';
    case 'MONTHLY_FEE':
    default:
      return 'Monthly';
  }
}

export function parseTotalCollectedThisMonth(data: Record<string, unknown>): number {
  if (data.totalCollectedThisMonth != null) {
    return Number(data.totalCollectedThisMonth) || 0;
  }
  return 0;
}

function buildFeeCollectionsQuery(params: FeeCollectionsQuery): string {
  const q = new URLSearchParams();
  if (params.startDate) q.set('startDate', params.startDate);
  if (params.endDate) q.set('endDate', params.endDate);
  if (params.billingMonth) q.set('billingMonth', params.billingMonth);
  if (params.category) q.set('category', params.category);
  q.set('page', String(params.page ?? 1));
  q.set('limit', String(params.limit ?? 50));
  return q.toString();
}

function parseFeeCollectionsPayload(
  data: unknown,
  expectedGymId?: string | number | null
): FeeCollectionsResult | null {
  const root = asRecord(data);
  if (!root) return null;
  const collectionsRaw = root.collections;
  if (!Array.isArray(collectionsRaw)) return null;
  const paginationRaw = asRecord(root.pagination);
  const page = Number(paginationRaw?.page) || 1;
  const limit = Number(paginationRaw?.limit) || 50;
  const total = Number(paginationRaw?.total) || 0;
  const gymId = root.gymId != null ? Number(root.gymId) : undefined;
  return {
    gymId,
    collections: collectionsRaw
      .map(normalizeFeeCollectionRow)
      .filter((row): row is FeeCollectionRow => row != null),
    pagination: {
      page,
      limit,
      total,
      totalPages: Number(paginationRaw?.totalPages) || Math.ceil(total / limit) || 0,
    },
    gymMismatch: assertResponseGymId(gymId, expectedGymId),
  };
}

/**
 * Paginated fee collection ledger. Tries reports route then dashboard alias.
 */
export async function fetchFeeCollections(
  api: AxiosInstance,
  params: FeeCollectionsQuery,
  expectedGymId?: string | number | null
): Promise<FeeCollectionsResult> {
  const query = buildFeeCollectionsQuery(params);
  const urls = [
    `/api/reports/fee-collections?${query}`,
    `/api/dashboard/fee-collections?${query}`,
  ];
  for (const url of urls) {
    try {
      const res = await api.get(url);
      if (!res.data?.success) continue;
      const parsed = parseFeeCollectionsPayload(res.data.data, expectedGymId);
      if (parsed) return parsed;
    } catch {
      continue;
    }
  }
  return {
    collections: [],
    pagination: { page: params.page ?? 1, limit: params.limit ?? 50, total: 0, totalPages: 0 },
    gymMismatch: null,
  };
}

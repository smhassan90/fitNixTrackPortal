import type { AxiosInstance } from 'axios';
import { getErrorMessage } from '@/lib/errorHandler';

/** Owner KPIs from GET /api/reports/financial-summary (or dashboard alias). */
export interface FinancialSummaryPayload {
  newMembersInRange?: number;
  newTrainersInRange?: number;
  expectedRevenueThisMonth?: number;
  overdueAmount?: number;
  pendingAmount?: number;
  advanceAmount?: number;
  /** Installment/row counts (legacy); prefer *MemberCount for UI when provided. */
  overdueCount?: number;
  pendingCount?: number;
  advanceCount?: number;
  /** Distinct members contributing to each bucket (recommended for reports UI). */
  overdueMemberCount?: number;
  pendingMemberCount?: number;
  advanceMemberCount?: number;
  /** Members included in expectedRevenueThisMonth (same basis as the amount). */
  expectedMemberCount?: number;
  /** Total actually received in [startDate, endDate] (same window as daily chart), if the API provides it. */
  amountCollectedInRange?: number;
  /** Distinct members with at least one payment in that range (same window as amountCollectedInRange). */
  membersCollectedInRange?: number;
  currency?: string;
}

export interface DailyReceivedRow {
  date: string;
  amount: number;
  paymentCount?: number;
}

function parseFinancialSummary(data: unknown): FinancialSummaryPayload {
  if (!data || typeof data !== 'object') return {};
  const d = data as Record<string, unknown>;
  return {
    newMembersInRange: d.newMembersInRange != null ? Number(d.newMembersInRange) : undefined,
    newTrainersInRange: d.newTrainersInRange != null ? Number(d.newTrainersInRange) : undefined,
    expectedRevenueThisMonth:
      d.expectedRevenueThisMonth != null
        ? Number(d.expectedRevenueThisMonth)
        : d.expectedCollectionsThisMonth != null
          ? Number(d.expectedCollectionsThisMonth)
          : undefined,
    overdueAmount: d.overdueAmount != null ? Number(d.overdueAmount) : undefined,
    pendingAmount: d.pendingAmount != null ? Number(d.pendingAmount) : undefined,
    advanceAmount: d.advanceAmount != null ? Number(d.advanceAmount) : undefined,
    overdueCount: d.overdueCount != null ? Number(d.overdueCount) : undefined,
    pendingCount: d.pendingCount != null ? Number(d.pendingCount) : undefined,
    advanceCount: d.advanceCount != null ? Number(d.advanceCount) : undefined,
    overdueMemberCount: d.overdueMemberCount != null ? Number(d.overdueMemberCount) : undefined,
    pendingMemberCount: d.pendingMemberCount != null ? Number(d.pendingMemberCount) : undefined,
    advanceMemberCount: d.advanceMemberCount != null ? Number(d.advanceMemberCount) : undefined,
    expectedMemberCount:
      d.expectedMemberCount != null
        ? Number(d.expectedMemberCount)
        : d.expectedRevenueMemberCount != null
          ? Number(d.expectedRevenueMemberCount)
          : undefined,
    amountCollectedInRange:
      d.amountCollectedInRange != null
        ? Number(d.amountCollectedInRange)
        : d.totalCollectedInRange != null
          ? Number(d.totalCollectedInRange)
          : d.paymentsReceivedInRange != null
            ? Number(d.paymentsReceivedInRange)
            : d.collectedInRange != null
              ? Number(d.collectedInRange)
              : undefined,
    membersCollectedInRange:
      d.membersCollectedInRange != null
        ? Number(d.membersCollectedInRange)
        : d.distinctMembersPaidInRange != null
          ? Number(d.distinctMembersPaidInRange)
          : d.membersWhoPaidInRange != null
            ? Number(d.membersWhoPaidInRange)
            : d.collectedMemberCount != null
              ? Number(d.collectedMemberCount)
              : undefined,
    currency: d.currency != null ? String(d.currency) : undefined,
  };
}

function rawSummaryLooksPresent(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  const keys = [
    'newMembersInRange',
    'newTrainersInRange',
    'expectedRevenueThisMonth',
    'expectedCollectionsThisMonth',
    'overdueAmount',
    'pendingAmount',
    'advanceAmount',
    'overdueCount',
    'pendingCount',
    'advanceCount',
    'overdueMemberCount',
    'pendingMemberCount',
    'advanceMemberCount',
    'expectedMemberCount',
    'expectedRevenueMemberCount',
    'amountCollectedInRange',
    'totalCollectedInRange',
    'paymentsReceivedInRange',
    'collectedInRange',
    'membersCollectedInRange',
    'distinctMembersPaidInRange',
    'membersWhoPaidInRange',
    'collectedMemberCount',
    'currency',
  ];
  return keys.some((k) => d[k] !== undefined && d[k] !== null && d[k] !== '');
}

export function normalizeDailyReceivedPayload(data: unknown): DailyReceivedRow[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;
  const days = d.days ?? d.byDay ?? d.items ?? d.rows ?? d.results;
  if (!Array.isArray(days)) return [];
  return days
    .map((row: Record<string, unknown>) => ({
      date: String(row.date ?? row.day ?? row.paidOn ?? '').slice(0, 10),
      amount: Number(row.amount ?? row.total ?? row.totalAmount ?? row.collected ?? 0) || 0,
      paymentCount:
        row.paymentCount != null
          ? Number(row.paymentCount)
          : row.count != null
            ? Number(row.count)
            : undefined,
    }))
    .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date));
}

function httpStatus(e: unknown): number | undefined {
  return (e as { response?: { status?: number } }).response?.status;
}

/**
 * Tries GET /api/reports/financial-summary then GET /api/dashboard/reports/financial-summary.
 * Surfaces 400/422 validation errors (e.g. startDate > endDate, range > 400 days).
 */
export async function fetchFinancialSummaryResult(
  api: AxiosInstance,
  params: { startDate: string; endDate: string; reportMonth: string }
): Promise<{ summary: FinancialSummaryPayload | null; error: string | null }> {
  const q = new URLSearchParams({
    startDate: params.startDate,
    endDate: params.endDate,
    reportMonth: params.reportMonth,
  });
  const urls = [
    `/api/reports/financial-summary?${q}`,
    `/api/dashboard/reports/financial-summary?${q}`,
  ];

  for (const url of urls) {
    try {
      const res = await api.get(url);
      const body = res.data as Record<string, unknown>;
      if (!body?.success) {
        const msg = (body?.error as { message?: string } | undefined)?.message || 'Request failed';
        return { summary: null, error: msg };
      }
      const data = body.data;
      if (!rawSummaryLooksPresent(data)) continue;
      return { summary: parseFinancialSummary(data), error: null };
    } catch (e: unknown) {
      const st = httpStatus(e);
      if (st === 400 || st === 422) {
        return { summary: null, error: getErrorMessage(e) };
      }
      if (st === 404) continue;
      continue;
    }
  }
  return { summary: null, error: null };
}

export type DailyPaymentsFetchResult = {
  rows: DailyReceivedRow[];
  /** True when the gym API (or portal proxy) returned a real payload, including an empty month. */
  hasLiveData: boolean;
  /** Distinct members who paid in range, if present on the same payload as `days`. */
  membersCollectedInRange?: number;
};

function parseMembersCollectedFromDailyPayload(d: Record<string, unknown>): number | undefined {
  const keys = [
    'membersCollectedInRange',
    'distinctMembersPaidInRange',
    'membersWhoPaidInRange',
    'membersWhoPaidCount',
    'collectedMemberCount',
    'distinctMemberCount',
  ] as const;
  for (const k of keys) {
    const v = d[k];
    if (v != null && v !== '') {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return undefined;
}

function parseDailyResponse(res: { data?: unknown }): DailyPaymentsFetchResult | null {
  const root = res.data as Record<string, unknown> | undefined;
  if (!root?.success || root.data == null || typeof root.data !== 'object') return null;
  const d = root.data as Record<string, unknown>;
  if (d.availability === 'backend_not_configured') {
    return { rows: [], hasLiveData: false };
  }
  const rows = normalizeDailyReceivedPayload(d);
  const membersCollectedInRange = parseMembersCollectedFromDailyPayload(d);
  return { rows, hasLiveData: true, membersCollectedInRange };
}

/**
 * Probe order: portal proxy, dashboard alias, payments alias (per backend integration spec).
 */
export async function tryFetchPaymentsReceivedDaily(
  api: AxiosInstance,
  params: { startDate: string; endDate: string }
): Promise<DailyPaymentsFetchResult> {
  const q = new URLSearchParams({
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const urls = [
    `/api/reports/payments-received-daily?${q}`,
    `/api/dashboard/payments-received-daily?${q}`,
    `/api/payments/received-daily?${q}`,
  ];
  for (const url of urls) {
    try {
      const res = await api.get(url);
      const parsed = parseDailyResponse(res);
      if (parsed) return parsed;
    } catch {
      continue;
    }
  }
  return { rows: [], hasLiveData: false };
}

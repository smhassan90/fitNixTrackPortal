/** Parse dashboard / revenue API payloads into a YYYY-MM → amount map. */

import type { AxiosInstance } from 'axios';
import { assertResponseGymId } from '@/lib/feeCollections';

export function currentYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function ymMonthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function eachYmBetween(a: string, b: string): string[] {
  const parse = (s: string) => {
    const [y, m] = s.split('-').map(Number);
    return y * 12 + (m - 1);
  };
  let i1 = parse(a);
  let i2 = parse(b);
  if (i1 > i2) [i1, i2] = [i2, i1];
  const out: string[] = [];
  for (let i = i1; i <= i2; i++) {
    const y = Math.floor(i / 12);
    const m = (i % 12) + 1;
    out.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return out;
}

export function monthsSpanningDateRange(startDate: string, endDate: string): { startMonth: string; endMonth: string } {
  const s = new Date(`${startDate}T12:00:00`);
  const e = new Date(`${endDate}T12:00:00`);
  const startMonth = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}`;
  const endMonth = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}`;
  if (startMonth > endMonth) return { startMonth: endMonth, endMonth: startMonth };
  return { startMonth, endMonth };
}

export function normalizeRevenueFromApiData(data: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};

  const raw = data.revenueByMonth;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (/^\d{4}-\d{2}$/.test(k)) {
        out[k] = Number(v) || 0;
      }
    }
  }

  const arr = data.monthlyRevenue ?? data.revenueByPeriod;
  if (Array.isArray(arr)) {
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const key = String(row.month ?? row.period ?? row.yearMonth ?? '');
      if (!/^\d{4}-\d{2}$/.test(key)) continue;
      const amt = row.amount ?? row.revenue ?? row.total ?? 0;
      out[key] = Number(amt) || 0;
    }
  }

  if (Object.keys(out).length === 0 && data.totalRevenue != null) {
    out[currentYm()] = Number(data.totalRevenue) || 0;
  }

  return out;
}

export interface RevenueFetchResult {
  revenueByMonth: Record<string, number>;
  totalRevenue?: number;
  gymId?: number;
  gymMismatch: string | null;
}

/**
 * Billing-month revenue from fee_collections ledger.
 * Tries GET /api/reports/revenue then GET /api/dashboard/revenue.
 */
export async function fetchRevenueReport(
  api: AxiosInstance,
  startMonth: string,
  endMonth: string,
  expectedGymId?: string | number | null
): Promise<RevenueFetchResult> {
  const q = `startMonth=${encodeURIComponent(startMonth)}&endMonth=${encodeURIComponent(endMonth)}`;
  const urls = [`/api/reports/revenue?${q}`, `/api/dashboard/revenue?${q}`];
  for (const url of urls) {
    try {
      const res = await api.get(url);
      if (!res.data?.success || res.data.data == null) continue;
      const raw = res.data.data as Record<string, unknown>;
      const revenueByMonth = normalizeRevenueFromApiData(raw);
      if (Object.keys(revenueByMonth).length === 0 && raw.revenueByMonth == null) continue;
      return {
        revenueByMonth,
        totalRevenue: raw.totalRevenue != null ? Number(raw.totalRevenue) : undefined,
        gymId: raw.gymId != null ? Number(raw.gymId) : undefined,
        gymMismatch: assertResponseGymId(raw.gymId, expectedGymId),
      };
    } catch {
      continue;
    }
  }
  return { revenueByMonth: {}, gymMismatch: null };
}

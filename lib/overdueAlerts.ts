import api from '@/lib/api';
import { normalizeMemberNumberFields } from '@/lib/displayMemberId';

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

/** Overdue payment details attached to an attendance record. */
export interface OverduePaymentInfo {
  overdueCount: number;
  overdueAmount: number;
  overdueSince: string | null;
  overdueMonths: string[];
}

/** Alert emitted when a member with overdue payments checks in. */
export interface OverdueCheckinAlert extends OverduePaymentInfo {
  memberId: number;
  memberNumber: string | null;
  legacyMemberId: string | null;
  memberName: string;
  contact: string | null;
  gender?: string | null;
  checkInTime: string;
}

export function normalizeOverduePaymentInfo(raw: unknown): OverduePaymentInfo | null {
  const o = asObj(raw);
  if (!o) return null;
  return {
    overdueCount: Number(o.overdueCount) || 0,
    overdueAmount: Number(o.overdueAmount) || 0,
    overdueSince: o.overdueSince != null && o.overdueSince !== '' ? String(o.overdueSince) : null,
    overdueMonths: Array.isArray(o.overdueMonths) ? o.overdueMonths.map((m) => String(m)) : [],
  };
}

export function normalizeOverdueAlert(raw: unknown): OverdueCheckinAlert | null {
  const o = asObj(raw);
  if (!o || o.memberId == null) return null;
  const memberId = Number(o.memberId);
  if (!Number.isFinite(memberId)) return null;
  const nums = normalizeMemberNumberFields(o);
  return {
    memberId,
    memberNumber: nums.memberNumber,
    legacyMemberId: nums.legacyMemberId,
    memberName: String(o.memberName ?? o.name ?? `Member ${memberId}`),
    contact: o.contact != null && o.contact !== '' ? String(o.contact) : o.phone != null && o.phone !== '' ? String(o.phone) : null,
    gender: o.gender != null && o.gender !== '' ? String(o.gender) : null,
    checkInTime: String(o.checkInTime ?? ''),
    overdueCount: Number(o.overdueCount) || 0,
    overdueAmount: Number(o.overdueAmount) || 0,
    overdueSince: o.overdueSince != null && o.overdueSince !== '' ? String(o.overdueSince) : null,
    overdueMonths: Array.isArray(o.overdueMonths) ? o.overdueMonths.map((m) => String(m)) : [],
  };
}

export function normalizeOverdueAlerts(raw: unknown): OverdueCheckinAlert[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeOverdueAlert).filter((a): a is OverdueCheckinAlert => a != null);
}

/** Session-scoped dedupe key: same alert can arrive from sync response and polling. */
export function overdueAlertKey(alert: { memberId: number | string; checkInTime: string }): string {
  return `${alert.memberId}|${alert.checkInTime}`;
}

/** "05 Jun 2026" style date for overdue messaging. */
export function formatOverdueDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** e.g. "3 overdue installments — Rs. 4,500 total, due since 05 Jun 2026 (months: 2026-05, 2026-06)". */
export function overdueDetailsText(info: OverduePaymentInfo): string {
  let text = `${info.overdueCount} overdue installment${info.overdueCount === 1 ? '' : 's'} — Rs. ${info.overdueAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })} total`;
  if (info.overdueSince) text += `, due since ${formatOverdueDate(info.overdueSince)}`;
  if (info.overdueMonths.length > 0) text += ` (months: ${info.overdueMonths.join(', ')})`;
  return text;
}

export interface OverdueCheckinsResponse {
  alerts: OverdueCheckinAlert[];
  serverTime: string;
}

/**
 * Poll for overdue-member check-ins since a given time.
 * Omit `since` on the first call (server defaults to today) to seed state.
 */
export async function fetchOverdueCheckins(since?: string): Promise<OverdueCheckinsResponse> {
  const params = new URLSearchParams();
  if (since) params.set('since', since);
  const qs = params.toString();
  const res = await api.get(`/api/attendance/overdue-checkins${qs ? `?${qs}` : ''}`);
  if (res.data?.success === false) {
    throw new Error(res.data?.error?.message || 'Failed to load overdue check-ins');
  }
  const payload = asObj(res.data?.data) ?? asObj(res.data) ?? {};
  return {
    alerts: normalizeOverdueAlerts(payload.alerts),
    serverTime: String(payload.serverTime ?? new Date().toISOString()),
  };
}

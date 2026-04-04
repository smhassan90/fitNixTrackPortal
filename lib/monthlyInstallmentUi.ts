import { differenceInCalendarDays } from 'date-fns';

export type InstallmentUiBucket = 'paid' | 'overdue' | 'pending' | 'advance';

/** API sends displayBucket (gym TZ on server); normalize case. Fallback only when absent (older API). */
export function normalizeDisplayBucket(
  raw: unknown,
  fallback?: () => InstallmentUiBucket
): InstallmentUiBucket {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (s === 'overdue' || s === 'pending' || s === 'advance' || s === 'paid') return s;
  if (fallback) return fallback();
  return 'pending';
}

/** Parse YYYY-MM-DD (or ISO) as local calendar date — fallback logic only. */
export function parseLocalDateInput(isoOrYmd: string): Date {
  const part = isoOrYmd.split('T')[0] ?? '';
  const [y, m, d] = part.split('-').map((x) => parseInt(x, 10));
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function yearMonth(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth();
}

/**
 * Browser-local fallback if API omits displayBucket (should match server rules conceptually;
 * authoritative overdue/pending/advance is GYM_TIMEZONE on the backend).
 */
export function uiBucketForUnpaid(dueDateStr: string, today = new Date()): 'overdue' | 'pending' | 'advance' {
  const due = startOfLocalDay(parseLocalDateInput(dueDateStr));
  const t0 = startOfLocalDay(today);
  if (Number.isNaN(due.getTime())) return 'pending';

  const dueYM = yearMonth(due);
  const nowYM = yearMonth(t0);
  if (dueYM < nowYM) return 'overdue';

  const daysPast = differenceInCalendarDays(t0, due);
  if (daysPast >= 1) return 'overdue';

  if (dueYM === nowYM) return 'pending';
  return 'advance';
}

export function uiBucketForInstallment(
  inst: { status: string; dueDate: string; displayBucket?: string | null }
): InstallmentUiBucket {
  if (inst.status === 'PAID') return 'paid';
  return normalizeDisplayBucket(inst.displayBucket, () => {
    const byDate = uiBucketForUnpaid(inst.dueDate);
    if (byDate === 'overdue') return 'overdue';
    if (inst.status === 'OVERDUE') return 'overdue';
    return byDate;
  });
}

export function uiBucketForNextUnpaid(nu: {
  displayBucket?: string | null;
  dueDate: string;
  status: string;
  isOverdue: boolean;
}): InstallmentUiBucket {
  return normalizeDisplayBucket(nu.displayBucket, () => {
    const byDate = uiBucketForUnpaid(nu.dueDate);
    if (byDate === 'overdue') return 'overdue';
    if (nu.status === 'OVERDUE' || nu.isOverdue) return 'overdue';
    return byDate;
  });
}

export function uiLabelForBucket(bucket: InstallmentUiBucket): string {
  switch (bucket) {
    case 'paid':
      return 'Paid';
    case 'overdue':
      return 'Overdue';
    case 'pending':
      return 'Pending';
    case 'advance':
      return 'Advance';
    default:
      return bucket;
  }
}

export function isInstallmentUnpaid(inst: { status: string }): boolean {
  return inst.status !== 'PAID';
}

export function tailwindBadgeForUiBucket(bucket: InstallmentUiBucket): string {
  switch (bucket) {
    case 'paid':
      return 'bg-green-100 text-green-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'overdue':
      return 'bg-red-100 text-red-800';
    case 'advance':
      return 'bg-sky-100 text-sky-900';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

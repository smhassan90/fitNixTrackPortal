import { differenceInCalendarDays } from 'date-fns';

/** Parse YYYY-MM-DD (or ISO) as local calendar date — avoids UTC shifting the day. */
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

export type InstallmentUiBucket = 'paid' | 'overdue' | 'pending' | 'advance';

/**
 * Unpaid installment UI bucket (local calendar):
 * - Overdue: due date has passed (today is after the due calendar day), OR billing month is before current month.
 * - Pending: due falls in the current month and the due day has not passed yet (still this month).
 * - Advance: due in a month strictly after the current month (future billing month).
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

export interface MonthlyInstallmentLike {
  id: string;
  status: string;
  dueDate: string;
}

/** True if staff should be able to mark this installment paid (advance only when older + current month are clear). */
export function canMarkUnpaidInstallment(inst: MonthlyInstallmentLike, all: MonthlyInstallmentLike[], today = new Date()): boolean {
  if (inst.status === 'PAID') return false;
  const bucket = uiBucketForInstallment(inst, today);
  if (bucket !== 'advance') return true;
  return !hasBlockingUnpaidBeforeAdvance(all, today);
}

/**
 * Advance prepay is offered only after everything through the current month is settled:
 * no unpaid rows in a month before the current month, none in the current month, and none overdue by date.
 */
export function hasBlockingUnpaidBeforeAdvance(all: MonthlyInstallmentLike[], today = new Date()): boolean {
  const t0 = startOfLocalDay(today);
  const nowYM = yearMonth(t0);
  const unpaid = all.filter((i) => i.status !== 'PAID');

  return unpaid.some((i) => {
    const due = startOfLocalDay(parseLocalDateInput(i.dueDate));
    if (Number.isNaN(due.getTime())) return true;
    const dueYM = yearMonth(due);
    const daysPast = differenceInCalendarDays(t0, due);
    if (daysPast >= 1) return true;
    if (dueYM < nowYM) return true;
    if (dueYM === nowYM) return true;
    return false;
  });
}

export function uiBucketForInstallment(
  inst: { status: string; dueDate: string },
  today = new Date()
): InstallmentUiBucket {
  if (inst.status === 'PAID') return 'paid';
  const byDate = uiBucketForUnpaid(inst.dueDate, today);
  if (byDate === 'overdue') return 'overdue';
  if (inst.status === 'OVERDUE') return 'overdue';
  return byDate;
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

/** Unpaid installments that can be marked paid (respects advance-after-current-month rule). */
export function payableUnpaidInstallments(all: MonthlyInstallmentLike[], today = new Date()): MonthlyInstallmentLike[] {
  return all.filter((i) => isInstallmentUnpaid(i) && canMarkUnpaidInstallment(i, all, today));
}

/** Next unpaid row on member summary — calendar rules first, then API overdue flags. */
export function uiBucketForNextUnpaid(nu: {
  dueDate: string;
  status: string;
  isOverdue: boolean;
}): InstallmentUiBucket {
  const byDate = uiBucketForUnpaid(nu.dueDate);
  if (byDate === 'overdue') return 'overdue';
  if (nu.status === 'OVERDUE' || nu.isOverdue) return 'overdue';
  return byDate;
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

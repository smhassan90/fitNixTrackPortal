import { uiBucketForInstallment } from '@/lib/monthlyInstallmentUi';
import { SIGNUP_PAY_BLOCK_MESSAGE } from '@/lib/signupFees';

export type PayableInstallment = {
  id?: string;
  status: string;
  dueDate: string;
  month?: string;
  displayBucket?: string | null;
  isProjected?: boolean;
};

function sortByDueDate(a: PayableInstallment, b: PayableInstallment) {
  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
}

export function installmentKey(inst: PayableInstallment): string {
  if (inst.id) return inst.id;
  return `${inst.month ?? ''}|${inst.dueDate}`;
}

export function unpaidInstallments(installments: PayableInstallment[]): PayableInstallment[] {
  return installments.filter((i) => i.status !== 'PAID').sort(sortByDueDate);
}

export function hasUnpaidOverdue(installments: PayableInstallment[]): boolean {
  return unpaidInstallments(installments).some((i) => uiBucketForInstallment(i) === 'overdue');
}

export function getPayBlockReason(
  inst: PayableInstallment,
  all: PayableInstallment[],
  options?: { pendingSignupOneTime?: boolean }
): string | null {
  if (options?.pendingSignupOneTime) {
    return SIGNUP_PAY_BLOCK_MESSAGE;
  }
  if (inst.status === 'PAID') return 'This installment is already paid.';

  const unpaid = unpaidInstallments(all);
  const earliest = unpaid[0];
  if (!earliest) return 'No unpaid installments.';

  const instDue = new Date(inst.dueDate).getTime();
  const earlierUnpaid = unpaid.filter((u) => new Date(u.dueDate).getTime() < instDue);
  if (earlierUnpaid.length === 0) return null;

  const instBucket = uiBucketForInstallment(inst);
  const overdueStillOpen = earlierUnpaid.some((u) => uiBucketForInstallment(u) === 'overdue');
  if (overdueStillOpen && instBucket !== 'overdue') {
    return 'Clear all overdue installments before paying pending or advance months.';
  }

  return `Pay ${earliest.month ?? 'the earliest unpaid month'} first.`;
}

export function canMarkInstallmentPaid(
  inst: PayableInstallment,
  all: PayableInstallment[],
  options?: { pendingSignupOneTime?: boolean }
): boolean {
  return getPayBlockReason(inst, all, options) === null;
}

/** Selected rows must be the first N unpaid installments — no skipping months. */
export function getBulkPayBlockReason(
  selected: PayableInstallment[],
  all: PayableInstallment[],
  options?: { pendingSignupOneTime?: boolean }
): string | null {
  if (options?.pendingSignupOneTime) {
    return SIGNUP_PAY_BLOCK_MESSAGE;
  }
  if (selected.length === 0) return 'Select at least one unpaid installment.';

  const unpaid = unpaidInstallments(all);
  const sortedSelected = [...selected].sort(sortByDueDate);
  const expected = unpaid.slice(0, sortedSelected.length);

  const matchesPrefix = expected.every((exp, idx) => {
    const sel = sortedSelected[idx];
    return installmentKey(exp) === installmentKey(sel);
  });

  if (matchesPrefix) return null;

  const hasOverdue = hasUnpaidOverdue(unpaid);
  const selectionHasPendingOrAdvance = sortedSelected.some((s) => {
    const bucket = uiBucketForInstallment(s);
    return bucket === 'pending' || bucket === 'advance';
  });
  if (hasOverdue && selectionHasPendingOrAdvance) {
    return 'Clear all overdue installments before paying pending or advance months.';
  }

  const earliest = unpaid[0];
  return `Pay installments in order starting from ${earliest?.month ?? 'the oldest due date'}.`;
}

/** Installments that may be bulk-selected together (contiguous prefix of unpaid rows). */
export function bulkSelectableUnpaid(
  all: PayableInstallment[],
  options?: { pendingSignupOneTime?: boolean }
): PayableInstallment[] {
  if (options?.pendingSignupOneTime) return [];
  const unpaid = unpaidInstallments(all);
  if (unpaid.length === 0) return [];

  const hasOverdue = hasUnpaidOverdue(unpaid);
  if (hasOverdue) {
    const overdues: PayableInstallment[] = [];
    for (const row of unpaid) {
      if (uiBucketForInstallment(row) === 'overdue') overdues.push(row);
      else break;
    }
    return overdues;
  }

  const withoutAdvance: PayableInstallment[] = [];
  for (const row of unpaid) {
    if (uiBucketForInstallment(row) === 'advance') break;
    withoutAdvance.push(row);
  }
  return withoutAdvance.length > 0 ? withoutAdvance : [unpaid[0]];
}

export function canSelectInstallmentForBulk(
  inst: PayableInstallment,
  all: PayableInstallment[],
  selectedIds: Set<string>,
  options?: { pendingSignupOneTime?: boolean }
): boolean {
  if (options?.pendingSignupOneTime) return false;
  if (inst.status === 'PAID') return false;

  const unpaid = unpaidInstallments(all);
  const selectable = bulkSelectableUnpaid(all);
  const selectableKeys = new Set(selectable.map(installmentKey));
  if (!selectableKeys.has(installmentKey(inst))) return false;

  const idx = unpaid.findIndex((u) => installmentKey(u) === installmentKey(inst));
  if (idx < 0) return false;

  for (let i = 0; i < idx; i++) {
    if (!selectedIds.has(installmentKey(unpaid[i]))) return false;
  }
  return true;
}

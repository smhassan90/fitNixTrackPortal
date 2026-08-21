export const EXPENSE_CHANGED_EVENT = 'fitnix:expense-changed';

export type ExpenseChangedDetail = {
  /** YYYY-MM of the affected entry, when known. */
  month?: string;
};

/** Fired after expense entry/head mutations so ledger and P&L can refetch. */
export function notifyExpenseChanged(month?: string): void {
  if (typeof window === 'undefined') return;
  const detail: ExpenseChangedDetail = { month };
  window.dispatchEvent(new CustomEvent(EXPENSE_CHANGED_EVENT, { detail }));
}

export function monthFromSpentAt(spentAt: string | null | undefined): string | undefined {
  const s = String(spentAt ?? '').trim();
  if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7);
  return undefined;
}

export type MonthlyInstallmentForProjection = {
  id: string;
  memberId?: string;
  month: string;
  amount: number;
  status: string;
  dueDate: string;
  paidDate: string | null;
  displayBucket?: string | null;
  isProjected?: boolean;
  member?: { id: string; name: string; phone: string | null; email: string | null };
};

const MONTH_KEY = /^(\d{4})-(\d{2})/;

function parseYm(month: string): { y: number; m: number } | null {
  const m = month.trim().match(MONTH_KEY);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) };
}

function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

function ymKey(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, '0')}`;
}

function firstOfMonthIso(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

function calendarMonthIndex(y: number, m: number): number {
  return y * 12 + (m - 1);
}

/**
 * If the API omits the **immediate** next billing month after the latest PAID row, add **one**
 * projected advance row (due on the 1st). After that month exists and is paid, the next load
 * adds only the following month — up to 12 months ahead of today (browser), then stops.
 */
export function mergeWithProjectedAdvanceMonths(
  rows: MonthlyInstallmentForProjection[],
  options?: { horizonMonthsFromToday?: number }
): MonthlyInstallmentForProjection[] {
  const horizonMonthsFromToday = options?.horizonMonthsFromToday ?? 12;

  const paidWithYm = rows
    .filter((r) => r.status === 'PAID')
    .map((r) => ({ r, ym: parseYm(r.month) }))
    .filter((x): x is { r: MonthlyInstallmentForProjection; ym: { y: number; m: number } } => x.ym !== null);

  if (paidWithYm.length === 0) return rows;

  let maxYm = paidWithYm[0].ym;
  let amountTemplate = paidWithYm[0].r.amount;
  for (const { r, ym } of paidWithYm) {
    if (calendarMonthIndex(ym.y, ym.m) > calendarMonthIndex(maxYm.y, maxYm.m)) {
      maxYm = ym;
      amountTemplate = r.amount;
    } else if (calendarMonthIndex(ym.y, ym.m) === calendarMonthIndex(maxYm.y, maxYm.m)) {
      amountTemplate = r.amount;
    }
  }

  const existingMonths = new Set<string>();
  for (const r of rows) {
    const ym = parseYm(r.month);
    if (ym) existingMonths.add(ymKey(ym.y, ym.m));
  }

  const next = addMonths(maxYm.y, maxYm.m, 1);
  const nextKey = ymKey(next.y, next.m);
  if (existingMonths.has(nextKey)) return rows;

  const today = new Date();
  const todayIdx = calendarMonthIndex(today.getFullYear(), today.getMonth() + 1);
  const nextIdx = calendarMonthIndex(next.y, next.m);
  if (nextIdx > todayIdx + horizonMonthsFromToday) return rows;

  const projected: MonthlyInstallmentForProjection = {
    id: `__projected__:${nextKey}`,
    month: nextKey,
    amount: amountTemplate > 0 ? amountTemplate : 0,
    status: 'PENDING',
    dueDate: firstOfMonthIso(next.y, next.m),
    paidDate: null,
    displayBucket: 'advance',
    isProjected: true,
  };

  const sortByDueDate = (a: MonthlyInstallmentForProjection, b: MonthlyInstallmentForProjection) =>
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();

  return [...rows, projected].sort(sortByDueDate);
}

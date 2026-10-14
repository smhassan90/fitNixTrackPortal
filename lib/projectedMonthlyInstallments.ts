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
  options?: { horizonMonthsFromToday?: number; billingResumeFrom?: string | null }
): MonthlyInstallmentForProjection[] {
  const horizonMonthsFromToday = options?.horizonMonthsFromToday ?? 12;

  const rowsWithYm = rows
    .map((r) => ({ r, ym: parseYm(r.month) }))
    .filter((x): x is { r: MonthlyInstallmentForProjection; ym: { y: number; m: number } } => x.ym !== null);

  const paidWithYm = rowsWithYm.filter((x) => x.r.status === 'PAID');
  if (paidWithYm.length === 0) return rows;

  let maxEntry = rowsWithYm[0];
  for (const entry of rowsWithYm) {
    if (calendarMonthIndex(entry.ym.y, entry.ym.m) >= calendarMonthIndex(maxEntry.ym.y, maxEntry.ym.m)) {
      maxEntry = entry;
    }
  }
  const maxYm = maxEntry.ym;
  const amountTemplate =
    paidWithYm[paidWithYm.length - 1]?.r.amount && paidWithYm[paidWithYm.length - 1].r.amount > 0
      ? [...paidWithYm].sort(
          (a, b) => calendarMonthIndex(b.ym.y, b.ym.m) - calendarMonthIndex(a.ym.y, a.ym.m)
        )[0].r.amount
      : maxEntry.r.amount;

  const existingMonths = new Set<string>();
  for (const r of rows) {
    const ym = parseYm(r.month);
    if (ym) existingMonths.add(ymKey(ym.y, ym.m));
  }

  let next = addMonths(maxYm.y, maxYm.m, 1);
  const resumeYm = options?.billingResumeFrom ? parseYm(options.billingResumeFrom.slice(0, 7)) : null;
  let dueDate = firstOfMonthIso(next.y, next.m);
  if (resumeYm && calendarMonthIndex(next.y, next.m) < calendarMonthIndex(resumeYm.y, resumeYm.m)) {
    next = resumeYm;
    dueDate = options!.billingResumeFrom!.slice(0, 10);
  } else {
    const anchorDay = maxEntry.r.dueDate.slice(8, 10);
    if (/^\d{2}$/.test(anchorDay)) {
      const lastDay = new Date(Date.UTC(next.y, next.m, 0)).getUTCDate();
      const day = Math.min(Number(anchorDay), lastDay);
      dueDate = `${ymKey(next.y, next.m)}-${String(day).padStart(2, '0')}`;
    }
  }
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
    dueDate,
    paidDate: null,
    displayBucket: 'advance',
    isProjected: true,
  };

  const sortByDueDate = (a: MonthlyInstallmentForProjection, b: MonthlyInstallmentForProjection) =>
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();

  return [...rows, projected].sort(sortByDueDate);
}

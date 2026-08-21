'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Layout from '@/components/Layout';
import {
  ChartPanelSkeleton,
  MetricCardsSkeleton,
  TableSkeleton,
} from '@/components/Skeleton';
import ExpenseKindBadge from '@/components/expenses/ExpenseKindBadge';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/lib/colors';
import { formatDate } from '@/lib/dateUtils';
import { EXPENSE_CHANGED_EVENT } from '@/lib/expenseEvents';
import { EXPENSE_PERMISSION_KEYS } from '@/lib/expensePermissions';
import {
  currentExpenseMonth,
  expenseErrorMessage,
  expenseKindLabel,
  fetchPnlSummary,
  formatExpenseMoney,
  type ExpenseKind,
  type PnlSummary,
} from '@/lib/expensesApi';
import { getErrorMessage, isForbiddenError } from '@/lib/errorHandler';
import { POS_PERMISSION_KEYS } from '@/lib/pos/permissions';

const KIND_ORDER: ExpenseKind[] = ['FIXED', 'PETTY', 'OTHER'];

function monthLabel(ym: string): string {
  try {
    return new Date(`${ym}-01T12:00:00`).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return ym;
  }
}

function netClass(value: number): string {
  return value >= 0 ? 'text-emerald-700' : 'text-red-700';
}

export default function MonthlyPnlPage() {
  const { can } = useAuth();
  const canRead = can(EXPENSE_PERMISSION_KEYS.pnlRead);
  const canViewExpenses = can(EXPENSE_PERMISSION_KEYS.read);
  const canViewPos =
    can(POS_PERMISSION_KEYS.catalogRead) ||
    can(POS_PERMISSION_KEYS.revenueRead) ||
    can(POS_PERMISSION_KEYS.sell);

  const [month, setMonth] = useState(() => currentExpenseMonth());
  const [data, setData] = useState<PnlSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!canRead) {
        setData(null);
        if (!opts?.silent) setLoading(false);
        return;
      }
      try {
        if (!opts?.silent) setLoading(true);
        setError(null);
        const summary = await fetchPnlSummary(month);
        setData(summary);
      } catch (err: unknown) {
        if (isForbiddenError(err)) {
          setError("You don't have permission to view profit & loss.");
        } else {
          setError(expenseErrorMessage(err) || getErrorMessage(err));
        }
        setData(null);
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [canRead, month]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ month?: string }>).detail;
      if (!detail?.month || detail.month === month) {
        void load({ silent: true });
      }
    };
    window.addEventListener(EXPENSE_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(EXPENSE_CHANGED_EVENT, onChanged);
  }, [load, month]);

  const currency = data?.currency || 'PKR';
  const money = (n: number) => formatExpenseMoney(n, currency);

  const kindMax = useMemo(() => {
    const vals = KIND_ORDER.map((k) => data?.byKind[k] ?? 0);
    return Math.max(1, ...vals);
  }, [data]);

  const categoryMax = useMemo(() => {
    const vals = (data?.byCategory ?? []).map((c) => c.amount);
    return Math.max(1, ...vals);
  }, [data]);

  const dailyChart = data?.dailyIncome ?? [];

  const showSkeleton = loading && !data;

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-dark-gray">Profit &amp; Loss</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Monthly snapshot for <strong>{monthLabel(month)}</strong>. Income comes from membership
              collections and POS — not a manual daily sales form. Pace and dues figures are forecasts,
              not actuals.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canViewExpenses && (
              <Link
                href="/expenses"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-dark-gray hover:bg-gray-50"
              >
                Expenses
              </Link>
            )}
            <Link
              href="/reports"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-dark-gray hover:bg-gray-50"
            >
              Reports
            </Link>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value || currentExpenseMonth())}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm"
            />
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-dark disabled:opacity-50"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {showSkeleton ? (
          <div className="space-y-8">
            <MetricCardsSkeleton count={5} />
            <TableSkeleton rows={1} columns={6} />
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ChartPanelSkeleton />
              <ChartPanelSkeleton />
            </section>
            <TableSkeleton rows={6} columns={4} />
          </div>
        ) : data ? (
          <>
            <section>
              <div className="flex w-full min-w-0 flex-nowrap gap-3 overflow-x-auto pb-1">
                <div className="min-w-[12rem] flex-1 basis-0 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-sm">
                  <p className="text-xs font-medium text-emerald-900/80">Income so far</p>
                  <p className="mt-1 text-xl font-bold text-emerald-800">{money(data.incomeSoFar)}</p>
                  <p className="mt-1 text-[11px] text-emerald-900/75">
                    Membership {money(data.membershipIncomeSoFar)} + POS {money(data.posSalesSoFar)}
                  </p>
                </div>
                <div className="min-w-[12rem] flex-1 basis-0 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-gray-500">Expenses so far</p>
                  <p className="mt-1 text-xl font-bold text-dark-gray">{money(data.expensesSoFar)}</p>
                  <p className="mt-1 text-[11px] text-gray-500">Booked this month</p>
                </div>
                <div
                  className={`min-w-[12rem] flex-1 basis-0 rounded-xl border p-4 shadow-sm ${
                    data.netSoFar >= 0 ? 'border-emerald-100 bg-emerald-50/40' : 'border-red-100 bg-red-50/50'
                  }`}
                >
                  <p className="text-xs font-medium text-gray-500">Net so far</p>
                  <p className={`mt-1 text-xl font-bold ${netClass(data.netSoFar)}`}>{money(data.netSoFar)}</p>
                  <p className="mt-1 text-[11px] text-gray-500">Actual income minus booked expenses</p>
                </div>
                <div className="min-w-[12rem] flex-1 basis-0 rounded-xl border border-blue-100 bg-blue-50/40 p-4 shadow-sm">
                  <p className="text-xs font-medium text-blue-900/80">Pace forecast</p>
                  <p className={`mt-1 text-xl font-bold ${netClass(data.paceProjection.projectedNet)}`}>
                    {money(data.paceProjection.projectedNet)}
                  </p>
                  <p
                    className="mt-1 text-[11px] text-blue-900/75"
                    title="Based on (income ÷ day of month × days in month) minus paced expenses plus unbooked recurring defaults."
                  >
                    Forecast — not actual. Income {money(data.paceProjection.projectedIncome)} / expenses{' '}
                    {money(data.paceProjection.projectedExpenses)}
                    {data.paceProjection.dayOfMonth > 0 && data.paceProjection.daysInMonth > 0
                      ? ` · day ${data.paceProjection.dayOfMonth} of ${data.paceProjection.daysInMonth}`
                      : ''}
                  </p>
                </div>
                <div className="min-w-[12rem] flex-1 basis-0 rounded-xl border border-amber-100 bg-amber-50/50 p-4 shadow-sm">
                  <p className="text-xs font-medium text-amber-900/80">If dues are collected</p>
                  <p className={`mt-1 text-xl font-bold ${netClass(data.duesProjection.projectedNet)}`}>
                    {money(data.duesProjection.projectedNet)}
                  </p>
                  <p className="mt-1 text-[11px] text-amber-900/80">
                    Forecast — not actual. Remaining dues {money(data.duesProjection.expectedRemaining)}. Income{' '}
                    {money(data.duesProjection.projectedIncome)} / expenses{' '}
                    {money(data.duesProjection.projectedExpenses)}
                  </p>
                </div>
              </div>
            </section>

            {data.remainingRecurring > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Unbooked recurring heads still expected this month: {money(data.remainingRecurring)}
              </div>
            )}

            <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-light-gray">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Total sales</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Fixed</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Petty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Other</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Total expense</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Net income</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-dark-gray">{money(data.summary.totalSales)}</td>
                      <td className="px-4 py-3">{money(data.summary.fixed)}</td>
                      <td className="px-4 py-3">{money(data.summary.petty)}</td>
                      <td className="px-4 py-3">{money(data.summary.other)}</td>
                      <td className="px-4 py-3">{money(data.summary.totalExpense)}</td>
                      <td className={`px-4 py-3 font-semibold ${netClass(data.summary.netIncome)}`}>
                        {money(data.summary.netIncome)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-dark-gray">Breakdown by kind</h2>
                <div className="mt-4 space-y-4">
                  {KIND_ORDER.map((k) => {
                    const amount = data.byKind[k] ?? 0;
                    const pct = Math.round((amount / kindMax) * 100);
                    return (
                      <div key={k}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <ExpenseKindBadge kind={k} />
                          <span className="text-sm font-medium text-dark-gray">{money(amount)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${pct}%` }}
                            aria-label={`${expenseKindLabel(k)} ${pct}%`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-dark-gray">Top expense heads</h2>
                {(data.byCategory ?? []).length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500">No expenses booked this month.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {data.byCategory.slice(0, 12).map((row) => {
                      const pct = Math.round((row.amount / categoryMax) * 100);
                      return (
                        <div key={`${row.categoryId}-${row.name}`}>
                          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                            <span className="min-w-0 truncate font-medium text-dark-gray">
                              {row.name}{' '}
                              <span className="font-normal text-gray-400">({expenseKindLabel(row.kind)})</span>
                            </span>
                            <span className="shrink-0 text-dark-gray">{money(row.amount)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100">
                            <div className="h-2 rounded-full bg-orange-400" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-dark-gray">Daily income</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Read-only from membership collections. No manual daily sales entry.
                </p>
              </div>
              {dailyChart.length === 0 ? (
                <p className="text-sm text-gray-500">No daily income rows for this month.</p>
              ) : (
                <>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v) => String(v).slice(8, 10)}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(value) => money(Number(value ?? 0))}
                          labelFormatter={(label) => formatDate(String(label))}
                        />
                        <Bar dataKey="amount" fill={colors.chart.primary} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-light-gray">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium uppercase text-dark-gray">Date</th>
                          <th className="px-3 py-2 text-left text-xs font-medium uppercase text-dark-gray">Amount</th>
                          <th className="px-3 py-2 text-left text-xs font-medium uppercase text-dark-gray">Payments</th>
                          <th className="px-3 py-2 text-left text-xs font-medium uppercase text-dark-gray">Members</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {dailyChart.map((row) => (
                          <tr key={row.date}>
                            <td className="px-3 py-2">{formatDate(row.date)}</td>
                            <td className="px-3 py-2 font-medium">{money(row.amount)}</td>
                            <td className="px-3 py-2">{row.paymentCount}</td>
                            <td className="px-3 py-2">{row.memberCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-dark-gray">Products / POS snapshot</h2>
                  <p className="mt-1 text-sm text-gray-500">Read-only from existing POS. Inventory is managed there.</p>
                </div>
                {canViewPos && (
                  <Link href="/pos/reports" className="text-sm font-medium text-primary hover:text-primary-dark">
                    Open POS reports
                  </Link>
                )}
              </div>
              <div className="mb-4 flex flex-wrap gap-4 text-sm">
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500">Sold amount</p>
                  <p className="font-semibold text-dark-gray">{money(data.productsSummary.soldAmount)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500">Sold quantity</p>
                  <p className="font-semibold text-dark-gray">
                    {data.productsSummary.soldQuantity.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-light-gray">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-dark-gray">Product</th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-dark-gray">Stock</th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-dark-gray">Sold qty</th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase text-dark-gray">Sold amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.productsSummary.items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-gray-500">
                          No POS sales this month.
                        </td>
                      </tr>
                    ) : (
                      data.productsSummary.items.map((item) => (
                        <tr key={item.productId || item.name}>
                          <td className="px-3 py-2 font-medium text-dark-gray">{item.name}</td>
                          <td className="px-3 py-2">{item.stockQuantity.toLocaleString()}</td>
                          <td className="px-3 py-2">{item.soldQuantity.toLocaleString()}</td>
                          <td className="px-3 py-2">{money(item.soldAmount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </Layout>
  );
}

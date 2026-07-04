'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import Loading from '@/components/Loading';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { formatDate } from '@/lib/dateUtils';
import { getErrorMessage } from '@/lib/errorHandler';
import { colors } from '@/lib/colors';
import {
  categoryLabel,
  fetchFeeCollections,
  type FeeCollectionCategory,
  type FeeCollectionRow,
  type FeeCollectionsPagination,
} from '@/lib/feeCollections';
import { fetchAllMemberSummaries } from '@/lib/fetchAllMemberSummaries';
import {
  fetchFinancialSummaryResult,
  tryFetchPaymentsReceivedDaily,
  type FinancialSummaryPayload,
  type DailyReceivedRow,
} from '@/lib/reportsOptionalApi';
import { fetchJoinCountsForRange } from '@/lib/reportJoinCounts';
import { uiBucketForNextUnpaid } from '@/lib/monthlyInstallmentUi';
import { reportsMemberSubline, type ReportsMemberSubline } from '@/lib/reportsMemberSubline';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function reportMonthFromEndDate(endDate: string): string {
  const d = new Date(`${endDate}T12:00:00`);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const REPORT_MAX_RANGE_DAYS = 400;

function inclusiveDaySpan(startDate: string, endDate: string): number {
  const a = new Date(`${startDate}T12:00:00`).getTime();
  const b = new Date(`${endDate}T12:00:00`).getTime();
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return Math.floor((hi - lo) / (24 * 60 * 60 * 1000)) + 1;
}

interface NextUnpaidLite {
  amount: number;
  month: string;
  dueDate: string;
  status: string;
  isOverdue: boolean;
  displayBucket?: string | null;
}

interface PaymentRow {
  memberId: string;
  memberName: string;
  overdueMonthCount: number;
  nextUnpaid: NextUnpaidLite | null;
  /** YYYY-MM-DD from member-summaries when the API exposes a last-payment timestamp. */
  lastPaidDay: string | null;
}

function firstDateString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (v == null || v === '') continue;
    const s = String(v).trim();
    if (s.length >= 10) return s;
  }
  return null;
}

/** Calendar day YYYY-MM-DD for “last payment” fields sometimes included on member-summaries. */
function extractLastPaidDayFromSummaryRaw(raw: Record<string, unknown>): string | null {
  const top = firstDateString(
    raw.lastPaymentDate,
    raw.lastPaidDate,
    raw.lastInstallmentPaidDate,
    raw.mostRecentPaymentDate,
    raw.lastFeeReceivedDate,
    raw.lastCollectionDate
  );
  if (top) return (top.split('T')[0] ?? top).slice(0, 10);

  const m = raw.member as Record<string, unknown> | undefined;
  if (m) {
    const fromMember = firstDateString(
      m.lastPaymentDate,
      m.lastPaidDate,
      m.lastInstallmentPaidDate,
      m.mostRecentPaymentDate
    );
    if (fromMember) return (fromMember.split('T')[0] ?? fromMember).slice(0, 10);
  }

  const ps = raw.paymentSummary as Record<string, unknown> | undefined;
  if (ps) {
    const s = firstDateString(ps.lastPaidDate, ps.lastPaymentDate, ps.lastPaidOn);
    if (s) return (s.split('T')[0] ?? s).slice(0, 10);
  }

  return null;
}

function calendarDayInInclusiveRange(day: string, start: string, end: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return day >= start && day <= end;
}

/** Members whose last recorded payment date falls in [start, end]. Undefined if summaries carry no last-paid fields. */
function membersFromSummariesLastPaidInRange(
  rows: PaymentRow[],
  start: string,
  end: string
): number | undefined {
  const anyLastPaid = rows.some((r) => r.lastPaidDay != null && r.lastPaidDay !== '');
  if (!anyLastPaid) return undefined;
  let n = 0;
  for (const r of rows) {
    if (r.lastPaidDay && calendarDayInInclusiveRange(r.lastPaidDay, start, end)) n += 1;
  }
  return n;
}

function normalizePaymentRow(raw: Record<string, unknown>): PaymentRow | null {
  const m = raw.member as Record<string, unknown> | undefined;
  const memberId = m?.id != null ? String(m.id) : '';
  const memberName = m?.name != null ? String(m.name) : '';
  if (!memberId) return null;
  const nu = raw.nextUnpaid as Record<string, unknown> | null | undefined;
  let nextUnpaid: NextUnpaidLite | null = null;
  if (nu && typeof nu === 'object') {
    nextUnpaid = {
      amount: Number(nu.amount) || 0,
      month: String(nu.month ?? ''),
      dueDate: String(nu.dueDate ?? ''),
      status: String(nu.status ?? ''),
      isOverdue: Boolean(nu.isOverdue),
      displayBucket: nu.displayBucket != null ? String(nu.displayBucket) : undefined,
    };
  }
  const lastPaidDay = extractLastPaidDayFromSummaryRaw(raw);
  return {
    memberId,
    memberName,
    overdueMonthCount: Number(raw.overdueMonthCount) || 0,
    nextUnpaid,
    lastPaidDay,
  };
}

function nextDueCalendarMonth(dueDate: string): string {
  const part = dueDate.split('T')[0] ?? '';
  return part.length >= 7 ? part.slice(0, 7) : '';
}

function fillDailyGaps(rows: DailyReceivedRow[], startDate: string, endDate: string): DailyReceivedRow[] {
  const map = new Map(rows.map((r) => [r.date, r]));
  const out: DailyReceivedRow[] = [];
  const cur = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  while (cur.getTime() <= end.getTime()) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    const existing = map.get(key);
    out.push(existing ?? { date: key, amount: 0, paymentCount: 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function maxAmountDay(chart: DailyReceivedRow[]): DailyReceivedRow | null {
  if (chart.length === 0) return null;
  return chart.reduce((a, b) => (b.amount > a.amount ? b : a));
}

function MemberSublineText({ line, tone }: { line: ReportsMemberSubline; tone: 'gray' | 'red' | 'amber' }) {
  if (line.kind !== 'count') return null;
  const cls =
    tone === 'gray'
      ? 'text-gray-600'
      : tone === 'red'
        ? 'text-red-800/75'
        : 'text-amber-900/75';
  return (
    <p className={`mt-1 text-[11px] ${cls}`}>
      {line.n} member{line.n !== 1 ? 's' : ''}
    </p>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);

  const [apiSummary, setApiSummary] = useState<FinancialSummaryPayload | null>(null);
  const [dailyReceived, setDailyReceived] = useState<DailyReceivedRow[] | null>(null);
  const [dailyFromApi, setDailyFromApi] = useState(false);
  /** Distinct members who paid (from daily payload); financial summary overrides in useMemo. */
  const [dailyMembersCollectedInRange, setDailyMembersCollectedInRange] = useState<number | undefined>(undefined);

  const [newMembers, setNewMembers] = useState<{ count: number; known: boolean }>({ count: 0, known: false });
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([]);

  const [feeCollections, setFeeCollections] = useState<FeeCollectionRow[]>([]);
  const [feePagination, setFeePagination] = useState<FeeCollectionsPagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  });
  const [feeCategory, setFeeCategory] = useState<FeeCollectionCategory | ''>('');
  const [feeCollectionsPage, setFeeCollectionsPage] = useState(1);
  const [feeCollectionsLoading, setFeeCollectionsLoading] = useState(false);
  const [feeGymMismatch, setFeeGymMismatch] = useState<string | null>(null);

  const reportMonth = useMemo(() => reportMonthFromEndDate(dateRange.endDate), [dateRange.endDate]);
  const reportMonthLabel = useMemo(() => {
    try {
      return new Date(`${reportMonth}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch {
      return reportMonth;
    }
  }, [reportMonth]);

  /** First and last calendar dates of the month that contains the selected end date (for the intro hint). */
  const reportMonthDayRange = useMemo(() => {
    const [y, m] = reportMonth.split('-').map((x) => parseInt(x, 10));
    if (!y || !m) return { firstLabel: '', lastLabel: '' };
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
    return {
      firstLabel: first.toLocaleDateString('en-US', opts),
      lastLabel: last.toLocaleDateString('en-US', opts),
    };
  }, [reportMonth]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setPaymentsError(null);

    if (dateRange.startDate > dateRange.endDate) {
      setLoadError('Start date must be on or before end date.');
      setLoading(false);
      setHasLoadedOnce(true);
      return;
    }
    if (inclusiveDaySpan(dateRange.startDate, dateRange.endDate) > REPORT_MAX_RANGE_DAYS) {
      setLoadError(`Choose a date range of ${REPORT_MAX_RANGE_DAYS} days or less.`);
      setLoading(false);
      setHasLoadedOnce(true);
      return;
    }

    try {
      const [fin, dailyResult, joinCounts] = await Promise.all([
        fetchFinancialSummaryResult(api, {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          reportMonth,
        }),
        tryFetchPaymentsReceivedDaily(api, {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
        fetchJoinCountsForRange(api, dateRange.startDate, dateRange.endDate),
      ]);

      if (fin.error) setLoadError(fin.error);

      let rawList: Record<string, unknown>[] = [];
      try {
        rawList = await fetchAllMemberSummaries({ onlyOpen: true });
      } catch (e: unknown) {
        setPaymentsError(getErrorMessage(e));
      }

      setApiSummary(fin.summary);
      setDailyReceived(fillDailyGaps(dailyResult.rows, dateRange.startDate, dateRange.endDate));
      setDailyFromApi(dailyResult.hasLiveData);
      setDailyMembersCollectedInRange(
        dailyResult.hasLiveData ? dailyResult.membersCollectedInRange : undefined
      );

      setNewMembers({
        count: fin.summary?.newMembersInRange ?? joinCounts.members.count,
        known:
          fin.summary?.newMembersInRange != null ||
          joinCounts.members.known ||
          joinCounts.members.usedServerFilter,
      });

      const rows = rawList.map(normalizePaymentRow).filter((r): r is PaymentRow => r != null);
      setPaymentRows(rows);
    } catch (e: unknown) {
      setLoadError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }, [dateRange.startDate, dateRange.endDate, reportMonth]);

  const loadFeeCollections = useCallback(async () => {
    if (dateRange.startDate > dateRange.endDate) return;
    setFeeCollectionsLoading(true);
    try {
      const result = await fetchFeeCollections(
        api,
        {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          category: feeCategory || undefined,
          page: feeCollectionsPage,
          limit: 25,
        },
        user?.gymId
      );
      setFeeCollections(result.collections);
      setFeePagination(result.pagination);
      if (result.gymMismatch) setFeeGymMismatch(result.gymMismatch);
    } finally {
      setFeeCollectionsLoading(false);
    }
  }, [dateRange.startDate, dateRange.endDate, feeCategory, feeCollectionsPage, user?.gymId]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  useEffect(() => {
    setFeeCollectionsPage(1);
  }, [dateRange.startDate, dateRange.endDate, feeCategory]);

  useEffect(() => {
    if (hasLoadedOnce) void loadFeeCollections();
  }, [loadFeeCollections, hasLoadedOnce]);

  const bucketMoney = useMemo(() => {
    let overdue = 0;
    let pending = 0;
    for (const r of paymentRows) {
      if (!r.nextUnpaid) continue;
      const b = uiBucketForNextUnpaid(r.nextUnpaid);
      const a = r.nextUnpaid.amount;
      if (b === 'overdue') overdue += a;
      else if (b === 'pending') pending += a;
    }
    return { overdue, pending };
  }, [paymentRows]);

  /** One row per member in summaries: counts = members whose *next unpaid* falls in each bucket / due month. */
  const bucketMemberCounts = useMemo(() => {
    let overdue = 0;
    let pending = 0;
    let expectedInMonth = 0;
    for (const r of paymentRows) {
      if (!r.nextUnpaid) continue;
      if (nextDueCalendarMonth(r.nextUnpaid.dueDate) === reportMonth) {
        expectedInMonth += 1;
      }
      const b = uiBucketForNextUnpaid(r.nextUnpaid);
      if (b === 'overdue') overdue += 1;
      else if (b === 'pending') pending += 1;
    }
    return { overdue, pending, expectedInMonth };
  }, [paymentRows, reportMonth]);

  const clientExpectedNextDueInMonth = useMemo(() => {
    let s = 0;
    for (const r of paymentRows) {
      if (!r.nextUnpaid) continue;
      if (nextDueCalendarMonth(r.nextUnpaid.dueDate) === reportMonth) s += r.nextUnpaid.amount;
    }
    return s;
  }, [paymentRows, reportMonth]);

  const displayExpected =
    apiSummary?.expectedRevenueThisMonth != null
      ? apiSummary.expectedRevenueThisMonth
      : clientExpectedNextDueInMonth;

  const displayOverdue = apiSummary?.overdueAmount ?? bucketMoney.overdue;
  const displayPending = apiSummary?.pendingAmount ?? bucketMoney.pending;

  const sublineExpected = useMemo(
    () =>
      reportsMemberSubline({
        displayAmount: displayExpected,
        amountFromApi: apiSummary?.expectedRevenueThisMonth != null,
        apiMemberCount: apiSummary?.expectedMemberCount,
        clientMemberCount: bucketMemberCounts.expectedInMonth,
      }),
    [
      displayExpected,
      apiSummary?.expectedRevenueThisMonth,
      apiSummary?.expectedMemberCount,
      bucketMemberCounts.expectedInMonth,
    ]
  );

  const sublineOverdue = useMemo(
    () =>
      reportsMemberSubline({
        displayAmount: displayOverdue,
        amountFromApi: apiSummary?.overdueAmount != null,
        apiMemberCount: apiSummary?.overdueMemberCount,
        clientMemberCount: bucketMemberCounts.overdue,
        fallbackClientWhenApiCountMissing: true,
      }),
    [displayOverdue, apiSummary?.overdueAmount, apiSummary?.overdueMemberCount, bucketMemberCounts.overdue]
  );

  const sublinePending = useMemo(
    () =>
      reportsMemberSubline({
        displayAmount: displayPending,
        amountFromApi: apiSummary?.pendingAmount != null,
        apiMemberCount: apiSummary?.pendingMemberCount,
        clientMemberCount: bucketMemberCounts.pending,
        fallbackClientWhenApiCountMissing: true,
      }),
    [displayPending, apiSummary?.pendingAmount, apiSummary?.pendingMemberCount, bucketMemberCounts.pending]
  );

  const moneyPrefix = useMemo(() => {
    const c = apiSummary?.currency;
    if (!c || String(c).toUpperCase() === 'PKR') return 'Rs. ';
    return `${c} `;
  }, [apiSummary?.currency]);

  const collectedFromDaily = useMemo(() => {
    return (dailyReceived ?? []).reduce((s, d) => s + (Number(d.amount) || 0), 0);
  }, [dailyReceived]);

  /** Cash received in the selected [startDate, endDate] window. */
  const displayCollected = useMemo(() => {
    if (apiSummary?.amountCollectedInRange != null) return apiSummary.amountCollectedInRange;
    if (apiSummary?.collectedAmountThisMonth != null) return apiSummary.collectedAmountThisMonth;
    if (dailyFromApi) return collectedFromDaily;
    return null;
  }, [
    apiSummary?.amountCollectedInRange,
    apiSummary?.collectedAmountThisMonth,
    dailyFromApi,
    collectedFromDaily,
  ]);

  const membersFromSummariesLastPaid = useMemo(
    () => membersFromSummariesLastPaidInRange(paymentRows, dateRange.startDate, dateRange.endDate),
    [paymentRows, dateRange.startDate, dateRange.endDate]
  );

  const membersPaidInPeriod = useMemo(() => {
    if (apiSummary?.membersCollectedInRange != null) return apiSummary.membersCollectedInRange;
    if (dailyMembersCollectedInRange != null) return dailyMembersCollectedInRange;
    if (membersFromSummariesLastPaid === undefined) return undefined;
    if (
      membersFromSummariesLastPaid === 0 &&
      displayCollected != null &&
      displayCollected > 0
    ) {
      return undefined;
    }
    return membersFromSummariesLastPaid;
  }, [
    apiSummary?.membersCollectedInRange,
    dailyMembersCollectedInRange,
    membersFromSummariesLastPaid,
    displayCollected,
  ]);

  /** Sum of daily paymentCount; used only when distinct member count is unknown (may exceed unique members). */
  const paymentsLoggedInPeriod = useMemo(() => {
    if (!dailyFromApi) return undefined;
    const s = (dailyReceived ?? []).reduce((acc, d) => acc + (Number(d.paymentCount) || 0), 0);
    return s > 0 ? s : undefined;
  }, [dailyFromApi, dailyReceived]);

  /** Shown under collected amount: prefer true member count, else payment-transaction count from daily API. */
  const collectedMembersDisplay = useMemo(() => {
    if (membersPaidInPeriod != null) return membersPaidInPeriod;
    return paymentsLoggedInPeriod ?? null;
  }, [membersPaidInPeriod, paymentsLoggedInPeriod]);

  const topOverdue = useMemo(() => {
    return [...paymentRows]
      .filter((r) => r.nextUnpaid && uiBucketForNextUnpaid(r.nextUnpaid) === 'overdue')
      .sort((a, b) => b.overdueMonthCount - a.overdueMonthCount)
      .slice(0, 10);
  }, [paymentRows]);

  const dailyChart = dailyReceived ?? [];
  const peakDay = maxAmountDay(dailyChart.filter((d) => d.amount > 0));

  if (!hasLoadedOnce && loading) {
    return (
      <Layout>
        <Loading message="Loading your reports…" />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-dark-gray">Business reports</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Pick the dates you care about above. The “money you’re expecting” amount is for{' '}
              <strong>{reportMonthLabel}</strong>—the month that contains your <strong>end date</strong>. For that whole
              month, set the range from <strong>{reportMonthDayRange.firstLabel}</strong> to{' '}
              <strong>{reportMonthDayRange.lastLabel}</strong>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange((d) => ({ ...d, startDate: e.target.value }))}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange((d) => ({ ...d, endDate: e.target.value }))}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm"
            />
            <button
              type="button"
              onClick={() => void loadReports()}
              disabled={loading}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-opacity-90 disabled:opacity-50"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {loadError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
        )}

        <section>
          <h2 className="mb-3 text-lg font-semibold text-dark-gray">Membership &amp; money overview</h2>
          <div className="flex w-full min-w-0 flex-nowrap gap-3 overflow-x-auto pb-1">
            <div className="min-w-[10rem] flex-1 basis-0 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500">New members (this period)</p>
              <p className="mt-1 text-2xl font-bold text-dark-gray">
                {newMembers.known ? newMembers.count : '—'}
              </p>
              {!newMembers.known && (
                <p className="mt-1 text-[11px] leading-snug text-amber-800">
                  We can’t see when people joined yet. Ask your software provider to store each member’s join date so this
                  count can appear.
                </p>
              )}
            </div>
            <div className="min-w-[10rem] flex-1 basis-0 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-sm">
              <p className="text-xs font-medium text-emerald-900/80">Collected so far (this period)</p>
              <p className="mt-1 text-xl font-bold text-emerald-800">
                {displayCollected != null ? (
                  <>
                    {moneyPrefix}
                    {displayCollected.toLocaleString()}
                  </>
                ) : (
                  '—'
                )}
              </p>
              {displayCollected == null && (
                <p className="mt-1 text-[11px] leading-snug text-emerald-900/75">
                  Total for this period isn’t available yet—check the day-by-day chart below when it has data.
                </p>
              )}
              {displayCollected != null && (
                <>
                  {displayCollected === 0 ? (
                    <p className="mt-1 text-[11px] text-emerald-900/70">No fees collected in this period.</p>
                  ) : (
                    <>
                      <p className="mt-1 text-[11px] font-medium text-emerald-900/80">
                        {collectedMembersDisplay != null ? (
                          <>
                            {collectedMembersDisplay} member{collectedMembersDisplay !== 1 ? 's' : ''}
                          </>
                        ) : (
                          <>
                            <span className="font-normal text-emerald-900/45">—</span> members
                          </>
                        )}
                      </p>
                      {collectedMembersDisplay == null && apiSummary?.amountCollectedInRange != null && (
                        <p className="mt-1 text-[11px] text-emerald-900/60">
                          From your billing summary for this date range.
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
            <div className="min-w-[10rem] flex-1 basis-0 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Money you’re expecting ({reportMonthLabel})</p>
              <p className="mt-1 text-xl font-bold text-teal-700">
                {moneyPrefix}
                {displayExpected.toLocaleString()}
              </p>
              <MemberSublineText line={sublineExpected} tone="gray" />
              {apiSummary?.expectedRevenueThisMonth == null && (
                <p className="mt-1 text-[11px] leading-snug text-gray-500">
                  Rough guide: adds up the next payment from each member whose due date falls in this month. It’s not the
                  full month’s billings—just what shows as “next due” today.
                </p>
              )}
            </div>
            <div className="min-w-[10rem] flex-1 basis-0 rounded-xl border border-red-100 bg-red-50/50 p-4 shadow-sm">
              <p className="text-xs font-medium text-red-800/80">Overdue (total)</p>
              <p className="mt-1 text-xl font-bold text-red-700">
                {moneyPrefix}
                {displayOverdue.toLocaleString()}
              </p>
              <MemberSublineText line={sublineOverdue} tone="red" />
              {apiSummary?.overdueAmount == null && (
                <p className="mt-1 text-[11px] leading-snug text-red-800/80">
                  Total of the next unpaid amount for everyone already in the overdue column.
                </p>
              )}
            </div>
            <div className="min-w-[10rem] flex-1 basis-0 rounded-xl border border-amber-100 bg-amber-50/50 p-4 shadow-sm">
              <p className="text-xs font-medium text-amber-900/80">Pending (total)</p>
              <p className="mt-1 text-xl font-bold text-amber-900">
                {moneyPrefix}
                {displayPending.toLocaleString()}
              </p>
              <MemberSublineText line={sublinePending} tone="amber" />
              {apiSummary?.pendingAmount == null && (
                <p className="mt-1 text-[11px] leading-snug text-amber-900/80">
                  Due this month but not marked overdue yet—what you’re still waiting on for the current month.
                </p>
              )}
            </div>
          </div>
          {paymentsError && <p className="mt-2 text-sm text-amber-700">{paymentsError}</p>}
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-dark-gray">Money in, day by day</h2>
              <p className="mt-1 text-sm text-gray-500">
                See which calendar days brought in the most fees. Useful for spotting patterns (for example right after
                payday).
              </p>
            </div>
            {dailyFromApi && peakDay && peakDay.amount > 0 && (
              <div className="rounded-lg bg-primary/10 px-3 py-2 text-right text-sm">
                <span className="text-gray-600">Busiest collection day</span>
                <p className="font-semibold text-dark-gray">
                  {peakDay.date} · {moneyPrefix}
                  {peakDay.amount.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {!dailyFromApi && (
            <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950">
              We’re not receiving day-by-day collection totals from your billing software yet, so this chart stays empty
              even when you collected money. Ask your software provider to connect “daily payments received” for this
              portal—if they need a written spec, it’s in{' '}
              <span className="font-medium">docs/BACKEND_REPORTS_API_PROMPT.md</span>.
            </p>
          )}

          {dailyFromApi && dailyChart.every((d) => d.amount === 0) && (
            <p className="mt-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              No payments were logged on any day in this date range (or every day was zero). Try widening the dates or
              check that fees are being recorded with a payment date.
            </p>
          )}

          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChart} margin={{ top: 8, right: 8, left: 8, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9 }}
                  angle={-35}
                  textAnchor="end"
                  height={60}
                  tickFormatter={(v) => {
                    try {
                      return new Date(`${v}T12:00:00`).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      });
                    } catch {
                      return v;
                    }
                  }}
                />
                <YAxis tick={{ fontSize: 10 }} width={48} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                <Tooltip
                  formatter={(value: number) => [
                    `${moneyPrefix}${Number(value ?? 0).toLocaleString()}`,
                    'Money in',
                  ]}
                  labelFormatter={(l) => String(l)}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={32}>
                  {dailyChart.map((entry) => (
                    <Cell
                      key={entry.date}
                      fill={
                        peakDay && entry.date === peakDay.date && entry.amount > 0
                          ? colors.primary.main
                          : colors.chart.secondary
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-dark-gray">Payments collected (ledger)</h2>
              <p className="mt-1 text-sm text-gray-500">
                Cash actually received in the selected date range.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-gray-500">
                Category
                <select
                  value={feeCategory}
                  onChange={(e) => setFeeCategory(e.target.value as FeeCollectionCategory | '')}
                  className="ml-2 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                >
                  <option value="">All</option>
                  <option value="MONTHLY_FEE">Monthly</option>
                  <option value="SIGNUP_FEE">Signup</option>
                  <option value="ADMISSION_ONLY">Admission only</option>
                </select>
              </label>
            </div>
          </div>

          {feeGymMismatch && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {feeGymMismatch}
            </p>
          )}

          {feeCollectionsLoading && feeCollections.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">Loading collection history…</p>
          ) : feeCollections.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
              No fee collections in this date range.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-light-gray">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase text-dark-gray">Collected</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase text-dark-gray">Member</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase text-dark-gray">Amount</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase text-dark-gray">Billing month</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase text-dark-gray">Type</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase text-dark-gray">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {feeCollections.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/80">
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatDate(row.collectedAt)}</td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/payments/members/${row.memberId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {row.memberName}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-medium">
                        {moneyPrefix}
                        {row.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{row.billingMonth ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {categoryLabel(row.category)}
                        </span>
                      </td>
                      <td className="max-w-xs truncate px-3 py-2 text-gray-600" title={row.description}>
                        {row.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {feePagination.totalPages > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-gray-500">
                Page {feePagination.page} of {feePagination.totalPages} · {feePagination.total} entries
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={feeCollectionsPage <= 1 || feeCollectionsLoading}
                  onClick={() => setFeeCollectionsPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={feeCollectionsPage >= feePagination.totalPages || feeCollectionsLoading}
                  onClick={() => setFeeCollectionsPage((p) => p + 1)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>

        {topOverdue.length > 0 && (
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-dark-gray">Members with the longest overdue streak</h2>
              <Link
                href="/payments?onlyWithOpenInstallments=true&bucket=overdue&sortBy=overdueCount&sortOrder=desc"
                className="text-sm font-medium text-primary"
              >
                Payments →
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-gray-100 text-sm">
              {topOverdue.map((r) => (
                <li key={r.memberId} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/payments/members/${r.memberId}`} className="font-medium text-primary hover:underline">
                    {r.memberName}
                  </Link>
                  <span className="shrink-0 text-gray-600">
                    {r.overdueMonthCount} mo · {moneyPrefix}
                    {(r.nextUnpaid?.amount ?? 0).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Layout>
  );
}

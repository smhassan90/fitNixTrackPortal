'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import Loading from '@/components/Loading';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errorHandler';
import { colors } from '@/lib/colors';
import {
  currentYm,
  eachYmBetween,
  fetchRevenueReport,
  normalizeRevenueFromApiData,
  ymMonthsAgo,
} from '@/lib/revenueFromApi';
import {
  assertResponseGymId,
  categoryLabel,
  normalizeRecentCollections,
  parseTotalCollectedThisMonth,
  type FeeCollectionRow,
} from '@/lib/feeCollections';
import { DASHBOARD_STATS_REFRESH_EVENT } from '@/lib/dashboardEvents';
import { formatDate } from '@/lib/dateUtils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DashboardStats {
  totalMembers: number;
  totalTrainers: number;
  pendingPayments: number;
  overduePayments: number;
  totalCollectedThisMonth: number;
}

type RevenuePresetId = 'this_month' | 'last_6_months' | 'last_12_months' | 'custom';

const RANGE_PRESETS: { id: RevenuePresetId; label: string; title: string }[] = [
  { id: 'this_month', label: 'This month', title: 'Current calendar month' },
  { id: 'last_6_months', label: '6 mo', title: 'Rolling last 6 months (including this month)' },
  { id: 'last_12_months', label: '12 mo', title: 'Rolling last 12 months (including this month)' },
  { id: 'custom', label: 'Custom', title: 'Pick any start and end month' },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentCollections, setRecentCollections] = useState<FeeCollectionRow[]>([]);
  const [gymMismatch, setGymMismatch] = useState<string | null>(null);
  const [revenueByMonthFull, setRevenueByMonthFull] = useState<Record<string, number>>({});
  const [revenuePreset, setRevenuePreset] = useState<RevenuePresetId>('last_6_months');
  const [revenueRangeStart, setRevenueRangeStart] = useState(() => ymMonthsAgo(5));
  const [revenueRangeEnd, setRevenueRangeEnd] = useState(() => currentYm());
  const [customFrom, setCustomFrom] = useState(() => ymMonthsAgo(5));
  const [customTo, setCustomTo] = useState(() => currentYm());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get('/api/dashboard/stats');

      if (response.data.success) {
        const data = response.data.data as Record<string, unknown>;
        const mismatch = assertResponseGymId(data.gymId, user?.gymId);
        setGymMismatch(mismatch);

        setStats({
          totalMembers: Number(data.totalMembers) || 0,
          totalTrainers: Number(data.totalTrainers) || 0,
          pendingPayments: Number(data.pendingPayments) || 0,
          overduePayments: Number(data.overduePayments) || 0,
          totalCollectedThisMonth: parseTotalCollectedThisMonth(data),
        });

        setRecentCollections(normalizeRecentCollections(data.recentCollections));

        setRevenueByMonthFull((prev) => ({
          ...prev,
          ...normalizeRevenueFromApiData(data),
        }));
      } else {
        throw new Error('API returned unsuccessful response');
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [user?.gymId]);

  const fetchRevenueForRange = useCallback(async (start: string, end: string) => {
    setRevenueLoading(true);
    try {
      const result = await fetchRevenueReport(api, start, end, user?.gymId);
      if (result.gymMismatch) setGymMismatch(result.gymMismatch);
      if (Object.keys(result.revenueByMonth).length > 0) {
        setRevenueByMonthFull((prev) => ({ ...prev, ...result.revenueByMonth }));
      }
    } catch {
      /* optional endpoint */
    } finally {
      setRevenueLoading(false);
    }
  }, [user?.gymId]);

  const applyRange = useCallback(
    (start: string, end: string, fetchRemote: boolean) => {
      let a = start;
      let b = end;
      if (a > b) [a, b] = [b, a];
      setRevenueRangeStart(a);
      setRevenueRangeEnd(b);
      if (fetchRemote) void fetchRevenueForRange(a, b);
    },
    [fetchRevenueForRange]
  );

  const applyPreset = useCallback(
    (id: RevenuePresetId) => {
      setRevenuePreset(id);
      if (id === 'this_month') {
        const c = currentYm();
        applyRange(c, c, true);
        return;
      }
      if (id === 'last_6_months') {
        applyRange(ymMonthsAgo(5), currentYm(), true);
        return;
      }
      if (id === 'last_12_months') {
        applyRange(ymMonthsAgo(11), currentYm(), true);
        return;
      }
      if (id === 'custom') {
        setCustomFrom(revenueRangeStart);
        setCustomTo(revenueRangeEnd);
      }
    },
    [applyRange, revenueRangeEnd, revenueRangeStart]
  );

  useEffect(() => {
    void fetchDashboardStats();
  }, [fetchDashboardStats]);

  useEffect(() => {
    const onRefresh = () => {
      void fetchDashboardStats();
    };
    window.addEventListener(DASHBOARD_STATS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(DASHBOARD_STATS_REFRESH_EVENT, onRefresh);
  }, [fetchDashboardStats]);

  useEffect(() => {
    void fetchRevenueForRange(ymMonthsAgo(5), currentYm());
  }, [fetchRevenueForRange]);

  const revenueChartData = useMemo(() => {
    const months = eachYmBetween(revenueRangeStart, revenueRangeEnd);
    return months.map((month) => ({
      month,
      amount: revenueByMonthFull[month] ?? 0,
    }));
  }, [revenueByMonthFull, revenueRangeStart, revenueRangeEnd]);

  const revenueRangeTotal = useMemo(
    () => revenueChartData.reduce((s, r) => s + r.amount, 0),
    [revenueChartData]
  );

  const presetSummary = useMemo(() => {
    if (revenuePreset === 'this_month') return 'This month';
    if (revenuePreset === 'last_6_months') return 'Last 6 months';
    if (revenuePreset === 'last_12_months') return 'Last 12 months';
    return 'Custom range';
  }, [revenuePreset]);

  const handleCardClick = (route: string, filter?: { key: string; value: string }) => {
    if (filter) {
      router.push(`${route}?${filter.key}=${filter.value}`);
    } else {
      router.push(route);
    }
  };

  const handlePaymentsLink = (search: string) => {
    router.push(`/payments${search}`);
  };

  const handleApplyCustomRange = () => {
    applyRange(customFrom, customTo, true);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardStats();
    const a = revenueRangeStart <= revenueRangeEnd ? revenueRangeStart : revenueRangeEnd;
    const b = revenueRangeStart <= revenueRangeEnd ? revenueRangeEnd : revenueRangeStart;
    await fetchRevenueForRange(a, b);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <Layout>
        <Loading message="Loading dashboard..." />
      </Layout>
    );
  }

  if (error || !stats) {
    return (
      <Layout>
        <div className="py-12 text-center">
          <div className="mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 p-6">
            <p className="mb-2 font-semibold text-red-600">Failed to load dashboard</p>
            <p className="mb-4 text-sm text-red-500">{error || 'Unknown error'}</p>
            <button
              onClick={fetchDashboardStats}
              className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-opacity-90"
            >
              Retry
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-dark-gray">Dashboard</h1>
            <p className="mt-1 text-gray-500">Welcome back! Here&apos;s what&apos;s happening today.</p>
          </div>
          <div className="text-sm text-gray-500">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </div>

        {gymMismatch && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {gymMismatch}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
          <div
            onClick={() => router.push('/reports')}
            className="transform cursor-pointer rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-sm font-medium text-emerald-100">Income</p>
                <p className="text-3xl font-bold">
                  Rs. {stats.totalCollectedThisMonth.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
                <p className="mt-2 text-xs text-emerald-100">Collected this month</p>
              </div>
              <div className="rounded-full bg-white bg-opacity-20 p-4">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div
            onClick={() => handleCardClick('/members')}
            className="transform cursor-pointer rounded-xl bg-primary p-6 text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-sm font-medium text-teal-100">Total Members</p>
                <p className="text-4xl font-bold">{stats.totalMembers}</p>
                <p className="mt-2 text-xs text-teal-100">Active members</p>
              </div>
              <div className="rounded-full bg-white bg-opacity-20 p-4">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
              </div>
            </div>
          </div>

          <div
            onClick={() => handleCardClick('/trainers')}
            className="transform cursor-pointer rounded-xl bg-blue p-6 text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-sm font-medium text-blue-100">Active Trainers</p>
                <p className="text-4xl font-bold">{stats.totalTrainers}</p>
                <p className="mt-2 text-xs text-blue-100">Available trainers</p>
              </div>
              <div className="rounded-full bg-white bg-opacity-20 p-4">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div
            onClick={() =>
              handlePaymentsLink(
                '?onlyWithOpenInstallments=true&bucket=pending&sortBy=nextDueDate&sortOrder=asc'
              )
            }
            className="transform cursor-pointer rounded-xl bg-orange p-6 text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-sm font-medium text-orange-100">Pending Payments</p>
                <p className="text-4xl font-bold">{stats.pendingPayments}</p>
                <p className="mt-2 text-xs text-orange-100">Awaiting payment</p>
              </div>
              <div className="rounded-full bg-white bg-opacity-20 p-4">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div
            onClick={() =>
              handlePaymentsLink(
                '?onlyWithOpenInstallments=true&bucket=overdue&sortBy=overdueCount&sortOrder=desc'
              )
            }
            className="transform cursor-pointer rounded-xl bg-gradient-to-br from-error to-error-dark p-6 text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-sm font-medium text-red-100">Overdue Payments</p>
                <p className="text-4xl font-bold">{stats.overduePayments}</p>
                <p className="mt-2 text-xs text-red-100">Requires attention</p>
              </div>
              <div className="rounded-full bg-white bg-opacity-20 p-4">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {recentCollections.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg">
            <div className="border-b border-gray-100 bg-slate-50/80 px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-dark-gray">Recent payments collected</h2>
                  <p className="mt-0.5 text-sm text-gray-500">Latest fee collection ledger entries</p>
                </div>
                <Link href="/reports" className="text-sm font-medium text-primary hover:underline">
                  Full history →
                </Link>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-light-gray">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Member</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Collected</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Billing month</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {recentCollections.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer hover:bg-gray-50/80"
                      onClick={() => router.push(`/payments/members/${row.memberId}`)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.memberName}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        Rs. {row.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(row.collectedAt)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.billingMonth ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {categoryLabel(row.category)}
                        </span>
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-600" title={row.description}>
                        {row.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-br from-white via-slate-50/80 to-blue-50/40 shadow-lg">
          <div className="border-b border-gray-100/80 bg-white/60 px-4 py-4 backdrop-blur-sm sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-dark-gray sm:text-xl">Revenue overview</h2>
                <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">
                  Billing-month collections from the fee ledger; missing months show as zero.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing || revenueLoading}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-dark-gray shadow-sm transition hover:border-primary/30 hover:bg-primary/5 disabled:opacity-50 sm:text-sm"
              >
                <svg
                  className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh data
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">Range</span>
              {RANGE_PRESETS.map((p) => {
                const active = revenuePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    title={p.title}
                    aria-pressed={active}
                    onClick={() => applyPreset(p.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition sm:text-sm ${
                      active
                        ? 'border-primary bg-primary text-white shadow-sm'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-primary/40 hover:bg-slate-50'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {revenuePreset === 'custom' && (
              <div className="mt-4 rounded-xl border border-gray-200 bg-slate-50/80 p-3 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="min-w-0 flex-1 sm:flex-initial">
                    <label className="mb-1 block text-[11px] font-medium text-gray-500">From</label>
                    <input
                      type="month"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="w-full min-w-[9rem] rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/25"
                    />
                  </div>
                  <div className="min-w-0 flex-1 sm:flex-initial">
                    <label className="mb-1 block text-[11px] font-medium text-gray-500">To</label>
                    <input
                      type="month"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="w-full min-w-[9rem] rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/25"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCustomRange}
                    disabled={revenueLoading}
                    className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-opacity-90 disabled:opacity-50"
                  >
                    {revenueLoading ? '…' : 'Apply'}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-600 sm:text-sm">
                <span className="font-semibold text-dark-gray">{presetSummary}</span>
                <span className="text-gray-300"> · </span>
                {revenueRangeStart === revenueRangeEnd ? (
                  <span>{revenueRangeStart}</span>
                ) : (
                  <span>
                    {revenueRangeStart} → {revenueRangeEnd}
                  </span>
                )}
                <span className="text-gray-300"> · </span>
                {revenueChartData.length} mo
              </p>
              <div className="rounded-xl bg-gradient-to-r from-blue to-blue/90 px-3 py-2 text-white shadow-sm sm:px-4">
                <p className="text-[10px] font-medium text-blue-100 sm:text-xs">Total</p>
                <p className="text-base font-bold sm:text-lg">Rs. {revenueRangeTotal.toLocaleString()}</p>
              </div>
            </div>

            <div className="mt-6 h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.chart.secondary} stopOpacity={1} />
                      <stop offset="95%" stopColor={colors.chart.secondary} stopOpacity={0.65} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf0" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickFormatter={(value) => {
                      try {
                        return new Date(`${value}-01`).toLocaleDateString('en-US', {
                          month: 'short',
                          year: '2-digit',
                        });
                      } catch {
                        return value;
                      }
                    }}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px rgba(15,23,42,0.12)',
                    }}
                    formatter={(value) => [`Rs. ${Number(value ?? 0).toLocaleString()}`, 'Revenue']}
                    labelFormatter={(label) => `Month ${label}`}
                  />
                  <Bar dataKey="amount" fill="url(#colorRevenue)" radius={[10, 10, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

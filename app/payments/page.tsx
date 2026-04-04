'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Layout from '@/components/Layout';
import Alert from '@/components/Alert';
import Loading from '@/components/Loading';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/dateUtils';
import { useAlert } from '@/hooks/useAlert';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errorHandler';

type SortByKey = 'name' | 'nextDueDate' | 'overdueCount';

interface MemberSummaryMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  packageId: string | null;
  membershipStart: string | null;
  membershipEnd: string | null;
  monthlyPaymentAmount: number | null;
}

interface NextUnpaid {
  paymentId: number;
  amount: number;
  dueDate: string;
  month: string;
  status: 'PENDING' | 'OVERDUE';
  isOverdue: boolean;
}

interface MemberPaymentSummaryRow {
  member: MemberSummaryMember;
  nextUnpaid: NextUnpaid | null;
  overdueMonthCount: number;
}

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function normalizeMemberSummary(raw: Record<string, unknown>): MemberPaymentSummaryRow {
  const m = raw.member as Record<string, unknown> | undefined;
  const member: MemberSummaryMember = {
    id: String(m?.id ?? ''),
    name: String(m?.name ?? ''),
    email: m?.email != null ? String(m.email) : null,
    phone: m?.phone != null ? String(m.phone) : null,
    packageId: m?.packageId != null ? String(m.packageId) : null,
    membershipStart: m?.membershipStart != null ? String(m.membershipStart) : null,
    membershipEnd: m?.membershipEnd != null ? String(m.membershipEnd) : null,
    monthlyPaymentAmount:
      m?.monthlyPaymentAmount != null ? Number(m.monthlyPaymentAmount) : null,
  };

  const nu = raw.nextUnpaid as Record<string, unknown> | null | undefined;
  let nextUnpaid: NextUnpaid | null = null;
  if (nu && typeof nu === 'object') {
    const pid = nu.paymentId ?? nu.id;
    nextUnpaid = {
      paymentId: Number(pid) || 0,
      amount: Number(nu.amount) || 0,
      dueDate: String(nu.dueDate ?? ''),
      month: String(nu.month ?? ''),
      status: (nu.status === 'OVERDUE' ? 'OVERDUE' : 'PENDING') as 'PENDING' | 'OVERDUE',
      isOverdue: Boolean(nu.isOverdue),
    };
  }

  return {
    member,
    nextUnpaid,
    overdueMonthCount: Number(raw.overdueMonthCount) || 0,
  };
}

export default function PaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { alert, showAlert, closeAlert } = useAlert();

  const [rows, setRows] = useState<MemberPaymentSummaryRow[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [sortBy, setSortBy] = useState<SortByKey>('nextDueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [onlyOpenInput, setOnlyOpenInput] = useState(false);
  const [onlyWithOpenInstallments, setOnlyWithOpenInstallments] = useState(false);

  const syncFromUrl = useCallback(() => {
    const open = searchParams.get('onlyWithOpenInstallments');
    const sortByParam = searchParams.get('sortBy') as SortByKey | null;
    const sortOrderParam = searchParams.get('sortOrder') as 'asc' | 'desc' | null;

    setOnlyOpenInput(open === 'true');
    setOnlyWithOpenInstallments(open === 'true');

    if (sortByParam === 'name' || sortByParam === 'nextDueDate' || sortByParam === 'overdueCount') {
      setSortBy(sortByParam);
    }
    if (sortOrderParam === 'asc' || sortOrderParam === 'desc') {
      setSortOrder(sortOrderParam);
    }
  }, [searchParams]);

  useEffect(() => {
    syncFromUrl();
  }, [syncFromUrl]);

  const fetchSummaries = useCallback(async () => {
    try {
      setLoading(true);
      setListError(null);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (onlyWithOpenInstallments) params.set('onlyWithOpenInstallments', 'true');
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      params.set('page', String(pagination.page));
      params.set('limit', String(pagination.limit));

      const response = await api.get(`/api/payments/member-summaries?${params.toString()}`);

      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || 'Failed to load payment summaries');
      }

      const data = response.data.data || {};
      const rawList = data.members ?? data.memberSummaries ?? data.summaries ?? [];
      const normalized = (rawList as Record<string, unknown>[]).map(normalizeMemberSummary);
      setRows(normalized);

      const p = data.pagination;
      if (p && typeof p === 'object') {
        setPagination((prev) => ({
          page: p.page != null && !Number.isNaN(Number(p.page)) ? Number(p.page) : prev.page,
          limit: p.limit != null && !Number.isNaN(Number(p.limit)) ? Number(p.limit) : prev.limit,
          total: p.total != null && !Number.isNaN(Number(p.total)) ? Number(p.total) : normalized.length,
          totalPages:
            p.totalPages != null && !Number.isNaN(Number(p.totalPages))
              ? Number(p.totalPages)
              : Math.max(1, Math.ceil((Number(p.total) || normalized.length) / prev.limit)),
        }));
      } else {
        setPagination((prev) => ({
          ...prev,
          total: normalized.length,
          totalPages: Math.max(1, Math.ceil(normalized.length / prev.limit)),
        }));
      }
    } catch (e: unknown) {
      const msg = getErrorMessage(e);
      setListError(msg);
      setRows([]);
      showAlert('error', 'Error', msg);
    } finally {
      setLoading(false);
    }
  }, [
    searchQuery,
    onlyWithOpenInstallments,
    sortBy,
    sortOrder,
    pagination.page,
    pagination.limit,
    showAlert,
  ]);

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  const handleSort = (key: SortByKey) => {
    if (sortBy === key) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortOrder(key === 'overdueCount' ? 'desc' : 'asc');
    }
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const handleApplySearch = () => {
    setSearchQuery(searchInput);
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const handleApplyOpenFilter = () => {
    setOnlyWithOpenInstallments(onlyOpenInput);
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const handleCheckOverdue = async () => {
    try {
      setLoading(true);
      const response = await api.post('/api/payments/generate-overdue');
      if (response.data?.success) {
        const updatedCount = response.data.data?.updated ?? 0;
        if (updatedCount > 0) {
          showAlert('success', 'Overdue updated', `${updatedCount} payment(s) marked as overdue.`);
        } else {
          showAlert('info', 'Up to date', 'No new overdue installments.');
        }
        await fetchSummaries();
      }
    } catch (e: unknown) {
      showAlert('error', 'Error', getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const getNextStatusStyle = (row: MemberPaymentSummaryRow) => {
    if (!row.nextUnpaid) return 'bg-gray-100 text-gray-700';
    if (row.nextUnpaid.status === 'OVERDUE' || row.nextUnpaid.isOverdue) {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-yellow-100 text-yellow-800';
  };

  const emptyMessage = useMemo(() => {
    if (searchQuery || onlyWithOpenInstallments) {
      return 'No members match your search or filters.';
    }
    return 'No members found.';
  }, [searchQuery, onlyWithOpenInstallments]);

  const showInitialSpinner = loading && rows.length === 0 && !listError;

  return (
    <Layout>
      <Alert isOpen={alert.isOpen} onClose={closeAlert} type={alert.type} title={alert.title} message={alert.message} />

      {showInitialSpinner ? (
        <Loading message="Loading payments…" />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-3xl font-bold text-dark-gray">Payments</h1>
              <p className="mt-1 text-sm text-gray-500">
                One row per member — open a member to view history and mark multiple months paid.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {user?.role === 'GYM_ADMIN' && (
                <button
                  type="button"
                  onClick={handleCheckOverdue}
                  className="rounded-lg bg-orange px-4 py-2 text-white transition-colors hover:bg-opacity-90"
                >
                  Check overdue
                </button>
              )}
            </div>
          </div>

          {listError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
              <p className="font-medium">Could not load payment list</p>
              <p className="text-sm">{listError}</p>
              <button
                type="button"
                onClick={() => fetchSummaries()}
                className="mt-3 rounded-lg bg-red-700 px-3 py-1.5 text-sm text-white hover:bg-red-800"
              >
                Retry
              </button>
            </div>
          )}

          <div className="rounded-lg bg-white p-4 shadow">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="relative min-w-0 flex-1">
                <label className="mb-1 block text-sm font-medium text-dark-gray">Search</label>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <input
                      type="text"
                      placeholder="Name, email, phone, or member ID…"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleApplySearch();
                      }}
                      className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 focus:border-transparent focus:ring-2 focus:ring-primary"
                    />
                    <svg
                      className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplySearch}
                    className="rounded-lg bg-primary px-5 py-2 font-medium text-white hover:bg-primary-dark"
                  >
                    Go
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-dark-gray">
                  <input
                    type="checkbox"
                    checked={onlyOpenInput}
                    onChange={(e) => setOnlyOpenInput(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  Open installments only
                </label>
                <button
                  type="button"
                  onClick={handleApplyOpenFilter}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  Apply filter
                </button>
                {(searchQuery || onlyWithOpenInstallments) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setSearchQuery('');
                      setOnlyOpenInput(false);
                      setOnlyWithOpenInstallments(false);
                      setSortBy('nextDueDate');
                      setSortOrder('asc');
                      setPagination((p) => ({ ...p, page: 1 }));
                      router.push('/payments');
                    }}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg bg-white shadow">
            {loading && rows.length > 0 && (
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-sm text-gray-500">Updating…</div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-light-gray">
                  <tr>
                    <th
                      className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-dark-gray hover:bg-gray-200"
                      onClick={() => handleSort('name')}
                    >
                      Member {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-dark-gray">
                      Next due
                    </th>
                    <th
                      className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-dark-gray hover:bg-gray-200"
                      onClick={() => handleSort('nextDueDate')}
                    >
                      Due date {sortBy === 'nextDueDate' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-dark-gray">
                      Status
                    </th>
                    <th
                      className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-dark-gray hover:bg-gray-200"
                      onClick={() => handleSort('overdueCount')}
                    >
                      Overdue months {sortBy === 'overdueCount' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {rows.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                        {listError ? '—' : emptyMessage}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr
                        key={row.member.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => router.push(`/payments/members/${row.member.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(`/payments/members/${row.member.id}`);
                          }
                        }}
                        className="cursor-pointer transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                      >
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="text-sm font-medium text-dark-gray">{row.member.name}</div>
                          <div className="text-sm text-gray-500">{row.member.phone || row.member.email || '—'}</div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {row.nextUnpaid ? (
                            <>
                              Rs. {row.nextUnpaid.amount.toFixed(2)}
                              <div className="text-xs text-gray-500">{row.nextUnpaid.month}</div>
                            </>
                          ) : (
                            <span className="text-gray-500">Caught up</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                          {row.nextUnpaid ? formatDate(row.nextUnpaid.dueDate) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          {row.nextUnpaid ? (
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getNextStatusStyle(row)}`}
                            >
                              {row.nextUnpaid.status === 'OVERDUE' || row.nextUnpaid.isOverdue ? 'Overdue' : 'Pending'}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-500">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {row.overdueMonthCount > 0 ? (
                            <span className="font-medium text-red-700">{row.overdueMonthCount}</span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row">
                <p className="text-sm text-gray-600">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} members)
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pagination.page <= 1 || loading}
                    onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={pagination.page >= pagination.totalPages || loading}
                    onClick={() =>
                      setPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))
                    }
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}

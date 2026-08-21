'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import Loading from '@/components/Loading';
import { useRouter, useSearchParams } from 'next/navigation';
import Layout from '@/components/Layout';
import Alert from '@/components/Alert';
import { FilterBarSkeleton, PageHeaderActionsSkeleton, TableSkeleton } from '@/components/Skeleton';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/dateUtils';
import { useAlert } from '@/hooks/useAlert';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errorHandler';
import {
  tailwindBadgeForUiBucket,
  uiBucketForNextUnpaid,
  uiLabelForBucket,
} from '@/lib/monthlyInstallmentUi';
import {
  normalizePendingOneTime,
  withResolvedAdmissionFee,
  type PendingOneTimePayment,
  SIGNUP_PAY_BLOCK_MESSAGE,
} from '@/lib/signupFees';
import { notifyDashboardStatsRefresh } from '@/lib/dashboardEvents';
import PaymentReceiptModal, {
  type PaymentReceiptTarget,
} from '@/components/PaymentReceiptModal';
import {
  receiptPrintedByFromUser,
} from '@/lib/paymentReceiptUrl';
import { downloadExcelCsv, excelExportFilename } from '@/lib/exportExcel';
import { displayMemberId, normalizeMemberNumberFields } from '@/lib/displayMemberId';
import { pickMemberPhotoUrl } from '@/lib/memberPhoto';
import MemberAvatar from '@/components/MemberAvatar';
import { photoUrlFromMap, useMemberPhotoMap } from '@/hooks/useMemberPhotoMap';

type SortByKey = 'name' | 'nextDueDate' | 'overdueCount' | 'status';

/** Next-unpaid bucket filter + PAID (no next unpaid on summary). */
type PaymentStatusFilter = 'all' | 'overdue' | 'pending' | 'paid';

interface MemberSummaryMember {
  id: string;
  memberNumber: string | null;
  legacyMemberId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  packageId: string | null;
  membershipStart: string | null;
  membershipEnd: string | null;
  monthlyPaymentAmount: number | null;
  photoUrl: string | null;
}

interface NextUnpaid {
  paymentId: number;
  amount: number;
  dueDate: string;
  month: string;
  status: 'PENDING' | 'OVERDUE';
  isOverdue: boolean;
  /** Server displayBucket (gym TZ); matches member detail. */
  displayBucket?: string | null;
}

interface MemberPaymentSummaryRow {
  member: MemberSummaryMember;
  nextUnpaid: NextUnpaid | null;
  nextOneTime: PendingOneTimePayment | null;
  overdueMonthCount: number;
}

/** Urgency order for Status column: overdue first when ascending. */
function rowStatusSortRank(row: MemberPaymentSummaryRow): number {
  if (row.nextOneTime) return 1;
  if (!row.nextUnpaid) return 4;
  const bucket = uiBucketForNextUnpaid({
    displayBucket: row.nextUnpaid.displayBucket,
    dueDate: row.nextUnpaid.dueDate,
    status: row.nextUnpaid.status,
    isOverdue: row.nextUnpaid.isOverdue,
  });
  switch (bucket) {
    case 'overdue':
      return 0;
    case 'pending':
      return 2;
    case 'advance':
      return 3;
    case 'paid':
      return 4;
    default:
      return 2;
  }
}

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

const PAGE_LIMIT = 25;

function normalizeMemberSummary(raw: Record<string, unknown>): MemberPaymentSummaryRow {
  const m = raw.member as Record<string, unknown> | undefined;
  const nums = normalizeMemberNumberFields(m);
  const member: MemberSummaryMember = {
    id: String(m?.id ?? ''),
    memberNumber: nums.memberNumber,
    legacyMemberId: nums.legacyMemberId,
    name: String(m?.name ?? ''),
    email: m?.email != null ? String(m.email) : null,
    phone: m?.phone != null ? String(m.phone) : null,
    packageId: m?.packageId != null ? String(m.packageId) : null,
    membershipStart: m?.membershipStart != null ? String(m.membershipStart) : null,
    membershipEnd: m?.membershipEnd != null ? String(m.membershipEnd) : null,
    monthlyPaymentAmount:
      m?.monthlyPaymentAmount != null ? Number(m.monthlyPaymentAmount) : null,
    photoUrl: pickMemberPhotoUrl(m),
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
      displayBucket: nu.displayBucket != null ? String(nu.displayBucket) : undefined,
    };
  }

  const nextOneTimeRaw =
    normalizePendingOneTime(raw.nextOneTime) ??
    normalizePendingOneTime(raw.pendingOneTime);
  const nextOneTime = nextOneTimeRaw ? withResolvedAdmissionFee(nextOneTimeRaw) : null;

  return {
    member,
    nextUnpaid,
    nextOneTime,
    overdueMonthCount: Number(raw.overdueMonthCount) || 0,
  };
}

function PaymentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, can } = useAuth();
  const { alert, showAlert, closeAlert } = useAlert();
  const canPay = can('gym.payments.manage');

  const [rows, setRows] = useState<MemberPaymentSummaryRow[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPages: 0,
    hasMore: false,
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const loadMoreLockRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const paginationRef = useRef(pagination);
  paginationRef.current = pagination;

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [sortBy, setSortBy] = useState<SortByKey>('nextDueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [onlyOpenInput, setOnlyOpenInput] = useState(false);
  const [onlyWithOpenInstallments, setOnlyWithOpenInstallments] = useState(false);
  /** From URL ?bucket= (dashboard) or ?status=paid */
  const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>('all');
  const [confirmPayRow, setConfirmPayRow] = useState<MemberPaymentSummaryRow | null>(null);
  const [confirmOneTimeRow, setConfirmOneTimeRow] = useState<MemberPaymentSummaryRow | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [checkingOverdue, setCheckingOverdue] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<PaymentReceiptTarget | null>(null);
  const photoMap = useMemberPhotoMap();

  const syncFromUrl = useCallback(() => {
    const open = searchParams.get('onlyWithOpenInstallments');
    const sortByParam = searchParams.get('sortBy') as SortByKey | null;
    const sortOrderParam = searchParams.get('sortOrder') as 'asc' | 'desc' | null;
    const bucketParam = searchParams.get('bucket');
    const statusParam = searchParams.get('status');

    setOnlyOpenInput(open === 'true');
    setOnlyWithOpenInstallments(open === 'true');

    if (statusParam === 'paid') {
      setStatusFilter('paid');
      setOnlyOpenInput(false);
      setOnlyWithOpenInstallments(false);
    } else if (bucketParam === 'overdue') {
      setStatusFilter('overdue');
    } else if (bucketParam === 'pending') {
      setStatusFilter('pending');
    } else {
      setStatusFilter('all');
    }

    if (
      sortByParam === 'name' ||
      sortByParam === 'nextDueDate' ||
      sortByParam === 'overdueCount' ||
      sortByParam === 'status'
    ) {
      setSortBy(sortByParam);
    }
    if (sortOrderParam === 'asc' || sortOrderParam === 'desc') {
      setSortOrder(sortOrderParam);
    }
  }, [searchParams]);

  useEffect(() => {
    syncFromUrl();
  }, [syncFromUrl]);

  const buildSummariesParams = useCallback(
    (page: number) => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(PAGE_LIMIT));
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const openOnlyForFetch = statusFilter === 'paid' ? false : onlyWithOpenInstallments;
      if (openOnlyForFetch) params.set('onlyWithOpenInstallments', 'true');

      if (statusFilter === 'overdue' || statusFilter === 'pending') {
        params.set('nextUnpaidBucket', statusFilter);
      } else if (statusFilter === 'paid') {
        params.set('status', 'paid');
      }

      // Status is sorted client-side; API only accepts name | nextDueDate | overdueCount
      params.set('sortBy', sortBy === 'status' ? 'name' : sortBy);
      params.set('sortOrder', sortOrder);
      return params;
    },
    [searchQuery, onlyWithOpenInstallments, sortBy, sortOrder, statusFilter]
  );

  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      if (append) {
        if (loadMoreLockRef.current) return;
        loadMoreLockRef.current = true;
        setLoadingMore(true);
      } else {
        setLoading(true);
        setListError(null);
      }

      try {
        const response = await api.get(
          `/api/payments/member-summaries?${buildSummariesParams(page).toString()}`
        );

        if (!response.data?.success) {
          throw new Error(response.data?.error?.message || 'Failed to load payment summaries');
        }

        const data = response.data.data || {};
        const rawList = data.members ?? data.memberSummaries ?? data.summaries ?? [];
        const normalized = (rawList as Record<string, unknown>[]).map(normalizeMemberSummary);

        setRows((prev) => {
          if (!append) return normalized;
          const seen = new Set(prev.map((r) => r.member.id));
          const added = normalized.filter((r) => !seen.has(r.member.id));
          return [...prev, ...added];
        });

        const p = data.pagination;
        const limit = p?.limit != null && !Number.isNaN(Number(p.limit)) ? Number(p.limit) : PAGE_LIMIT;
        const total =
          p?.total != null && !Number.isNaN(Number(p.total)) ? Number(p.total) : normalized.length;
        const totalPages =
          p?.totalPages != null && !Number.isNaN(Number(p.totalPages))
            ? Number(p.totalPages)
            : Math.max(1, Math.ceil(total / limit));
        const currentPage =
          p?.page != null && !Number.isNaN(Number(p.page)) ? Number(p.page) : page;
        const hasMore =
          p?.hasMore === true ||
          (p?.hasMore === false
            ? false
            : currentPage < totalPages);

        setPagination({
          page: currentPage,
          limit,
          total,
          totalPages,
          hasMore,
        });
      } catch (e: unknown) {
        const msg = getErrorMessage(e);
        if (!append) {
          setListError(msg);
          setRows([]);
          setPagination({
            page: 1,
            limit: PAGE_LIMIT,
            total: 0,
            totalPages: 0,
            hasMore: false,
          });
          showAlert('error', 'Error', msg);
        }
      } finally {
        if (append) {
          setLoadingMore(false);
          loadMoreLockRef.current = false;
        } else {
          setLoading(false);
        }
      }
    },
    [buildSummariesParams, showAlert]
  );

  const refreshList = useCallback(() => fetchPage(1, false), [fetchPage]);

  const listQueryKey = useMemo(
    () =>
      JSON.stringify({
        searchQuery,
        onlyWithOpenInstallments,
        sortBy,
        sortOrder,
        statusFilter,
      }),
    [searchQuery, onlyWithOpenInstallments, sortBy, sortOrder, statusFilter]
  );

  useEffect(() => {
    setRows([]);
    setPagination({
      page: 1,
      limit: PAGE_LIMIT,
      total: 0,
      totalPages: 0,
      hasMore: false,
    });
    void fetchPage(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset list when query key changes
  }, [listQueryKey]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !pagination.hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const pg = paginationRef.current;
        if (entries[0]?.isIntersecting && pg.hasMore && !loading && !loadingMore) {
          void fetchPage(pg.page + 1, true);
        }
      },
      { rootMargin: '240px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pagination.hasMore, pagination.page, loading, loadingMore, fetchPage]);

  const handleSort = (key: SortByKey) => {
    if (sortBy === key) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortOrder(key === 'overdueCount' ? 'desc' : 'asc');
    }
  };

  const handleApplySearch = () => {
    setSearchQuery(searchInput);
  };

  const handleApplyOpenFilter = () => {
    setOnlyWithOpenInstallments(onlyOpenInput);
  };

  const handleMarkOneTimePaid = async (row: MemberPaymentSummaryRow) => {
    const oneTime = row.nextOneTime;
    if (!oneTime?.id) {
      showAlert('error', 'Cannot mark paid', 'No pending signup payment was found for this member.');
      return;
    }
    const oneTimeId = oneTime.id;
    try {
      setMarkingPaid(true);
      const response = await api.patch(`/api/payments/one-time/${oneTimeId}/mark-paid`);
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || 'Mark paid failed');
      }
      setConfirmOneTimeRow(null);
      notifyDashboardStatsRefresh();
      await refreshList();
      setReceiptTarget({
        kind: 'one-time',
        id: oneTimeId,
        memberId: row.member.id,
        fallbackPhone: row.member.phone,
        printedBy: receiptPrintedByFromUser(user),
      });
    } catch (e: unknown) {
      showAlert('error', 'Error', getErrorMessage(e));
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleMarkNextPaid = async (row: MemberPaymentSummaryRow) => {
    if (row.nextOneTime) {
      showAlert('warning', 'Pay signup first', SIGNUP_PAY_BLOCK_MESSAGE);
      setConfirmPayRow(null);
      return;
    }
    const nextUnpaid = row.nextUnpaid;
    const paymentId = nextUnpaid?.paymentId;
    if (!paymentId || !nextUnpaid) {
      showAlert('error', 'Cannot mark paid', 'No open installment was found for this member.');
      return;
    }
    const nextBucket = uiBucketForNextUnpaid({
      displayBucket: nextUnpaid.displayBucket,
      dueDate: nextUnpaid.dueDate,
      status: nextUnpaid.status,
      isOverdue: nextUnpaid.isOverdue,
    });
    if (row.overdueMonthCount > 0 && nextBucket !== 'overdue') {
      showAlert(
        'warning',
        'Pay in order',
        'Clear all overdue installments before paying pending or advance months.'
      );
      setConfirmPayRow(null);
      return;
    }
    try {
      setMarkingPaid(true);
      const response = await api.patch(`/api/payments/${paymentId}/mark-paid`);
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || 'Mark paid failed');
      }
      setConfirmPayRow(null);
      notifyDashboardStatsRefresh();
      await refreshList();
      setReceiptTarget({
        kind: 'monthly',
        id: paymentId,
        memberId: row.member.id,
        fallbackPhone: row.member.phone,
        printedBy: receiptPrintedByFromUser(user),
      });
    } catch (e: unknown) {
      showAlert('error', 'Error', getErrorMessage(e));
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleCheckOverdue = async () => {
    try {
      setCheckingOverdue(true);
      const response = await api.post('/api/payments/generate-overdue');
      if (response.data?.success) {
        const updatedCount = response.data.data?.updated ?? 0;
        if (updatedCount > 0) {
          showAlert('success', 'Overdue updated', `${updatedCount} payment(s) marked as overdue.`);
        } else {
          showAlert('info', 'Up to date', 'No new overdue installments.');
        }
        await refreshList();
      }
    } catch (e: unknown) {
      showAlert('error', 'Error', getErrorMessage(e));
    } finally {
      setCheckingOverdue(false);
    }
  };

  const emptyMessage = useMemo(() => {
    if (statusFilter === 'overdue') {
      return 'No members whose next open installment is overdue.';
    }
    if (statusFilter === 'pending') {
      return 'No members whose next open installment is pending or advance (not yet overdue).';
    }
    if (statusFilter === 'paid') {
      return 'No PAID members (no next due on this list).';
    }
    if (searchQuery || onlyWithOpenInstallments) {
      return 'No members match your search or filters.';
    }
    return 'No members found.';
  }, [searchQuery, onlyWithOpenInstallments, statusFilter]);

  const tableRows = useMemo(() => {
    const base =
      statusFilter === 'paid'
        ? rows.filter((row) => !row.nextUnpaid && !row.nextOneTime)
        : rows;
    if (sortBy !== 'status') return base;
    const dir = sortOrder === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => {
      const diff = (rowStatusSortRank(a) - rowStatusSortRank(b)) * dir;
      if (diff !== 0) return diff;
      return a.member.name.localeCompare(b.member.name);
    });
  }, [rows, statusFilter, sortBy, sortOrder]);

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const out: MemberPaymentSummaryRow[] = [];

      for (let page = 1; page <= 200; page++) {
        const params = buildSummariesParams(page);
        const response = await api.get(`/api/payments/member-summaries?${params.toString()}`);
        if (!response.data?.success) {
          throw new Error(response.data?.error?.message || 'Failed to load payment summaries');
        }

        const data = response.data.data || {};
        const rawList = (data.members ?? data.memberSummaries ?? data.summaries ?? []) as Record<
          string,
          unknown
        >[];
        out.push(...rawList.map(normalizeMemberSummary));

        const p = data.pagination;
        const hasMore =
          p?.hasMore === true ||
          (p?.hasMore === false
            ? false
            : page < (Number(p?.totalPages) || 1));
        if (!hasMore || rawList.length === 0) break;
      }

      const dataToExport =
        statusFilter === 'paid'
          ? out.filter((row) => !row.nextUnpaid && !row.nextOneTime)
          : out;
      if (dataToExport.length === 0) {
        showAlert('info', 'Nothing to export', 'No payment rows match the current filters.');
        return;
      }

      const headers = [
        'Member ID',
        'Name',
        'Phone',
        'Email',
        'Signup Due',
        'Monthly Amount',
        'Month',
        'Due Date',
        'Status',
        'Overdue Months',
        'Membership Start',
        'Membership End',
        'Monthly Package Amount',
      ];

      const exportRows = dataToExport.map((row) => {
        const nextBucket = row.nextUnpaid
          ? uiBucketForNextUnpaid({
              displayBucket: row.nextUnpaid.displayBucket,
              dueDate: row.nextUnpaid.dueDate,
              status: row.nextUnpaid.status,
              isOverdue: row.nextUnpaid.isOverdue,
            })
          : null;
        const status = row.nextOneTime
          ? 'SIGNUP'
          : !row.nextUnpaid
            ? 'PAID'
            : nextBucket === 'overdue'
              ? 'OVERDUE'
              : nextBucket === 'pending'
                ? 'PENDING'
                : nextBucket === 'advance'
                  ? 'ADVANCE'
                  : nextBucket
                    ? uiLabelForBucket(nextBucket).toUpperCase()
                    : '';

        return [
          displayMemberId(row.member) === '—' ? '' : displayMemberId(row.member),
          row.member.name,
          row.member.phone || '',
          row.member.email || '',
          row.nextOneTime ? row.nextOneTime.totalAmount.toFixed(2) : '',
          row.nextUnpaid ? row.nextUnpaid.amount.toFixed(2) : '',
          row.nextUnpaid?.month || '',
          row.nextOneTime
            ? 'At signup'
            : row.nextUnpaid
              ? formatDate(row.nextUnpaid.dueDate) === 'N/A'
                ? ''
                : formatDate(row.nextUnpaid.dueDate)
              : '',
          status,
          row.overdueMonthCount,
          formatDate(row.member.membershipStart) === 'N/A'
            ? ''
            : formatDate(row.member.membershipStart),
          formatDate(row.member.membershipEnd) === 'N/A' ? '' : formatDate(row.member.membershipEnd),
          row.member.monthlyPaymentAmount != null
            ? Number(row.member.monthlyPaymentAmount).toFixed(2)
            : '',
        ];
      });

      downloadExcelCsv(excelExportFilename('payments'), headers, exportRows);
    } catch (e: unknown) {
      showAlert('error', 'Export failed', getErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const setStatusFilterAndUrl = useCallback(
    (next: PaymentStatusFilter) => {
      setStatusFilter(next);
      if (next === 'paid') {
        setOnlyOpenInput(false);
        setOnlyWithOpenInstallments(false);
      }
      const p = new URLSearchParams(searchParams.toString());
      p.delete('bucket');
      p.delete('status');
      if (next === 'paid') {
        p.delete('onlyWithOpenInstallments');
        p.set('status', 'paid');
      } else if (next === 'overdue') p.set('bucket', 'overdue');
      else if (next === 'pending') p.set('bucket', 'pending');
      const qs = p.toString();
      router.replace(qs ? `/payments?${qs}` : '/payments');
    },
    [router, searchParams]
  );

  const showInitialSpinner = loading && rows.length === 0 && !listError;

  const tableColumnCount = canPay ? 6 : 5;

  return (
    <Layout>
      <Alert isOpen={alert.isOpen} onClose={closeAlert} type={alert.type} title={alert.title} message={alert.message} />
      <PaymentReceiptModal
        target={receiptTarget}
        onClose={() => setReceiptTarget(null)}
        onError={(message) => showAlert('warning', 'Receipt', message)}
      />
      <ConfirmationDialog
        isOpen={!!confirmOneTimeRow}
        onClose={() => !markingPaid && setConfirmOneTimeRow(null)}
        onConfirm={() => confirmOneTimeRow && void handleMarkOneTimePaid(confirmOneTimeRow)}
        title="Mark signup payment as paid"
        message={
          confirmOneTimeRow?.nextOneTime
            ? `Mark signup payment of Rs. ${confirmOneTimeRow.nextOneTime.totalAmount.toFixed(2)} for ${confirmOneTimeRow.member.name} as paid? (Admission Rs. ${confirmOneTimeRow.nextOneTime.admissionFee.toFixed(2)}, package 1st month Rs. ${confirmOneTimeRow.nextOneTime.packageFee.toFixed(2)}, trainer Rs. ${confirmOneTimeRow.nextOneTime.trainerFee.toFixed(2)})`
            : ''
        }
        confirmText={markingPaid ? 'Saving…' : 'Mark signup paid'}
        cancelText="Cancel"
        type="warning"
      />
      <ConfirmationDialog
        isOpen={!!confirmPayRow}
        onClose={() => !markingPaid && setConfirmPayRow(null)}
        onConfirm={() => confirmPayRow && void handleMarkNextPaid(confirmPayRow)}
        title="Mark installment as paid"
        message={
          confirmPayRow?.nextUnpaid
            ? `Mark Rs. ${confirmPayRow.nextUnpaid.amount.toFixed(2)} for ${confirmPayRow.member.name} (${confirmPayRow.nextUnpaid.month}) as paid?`
            : ''
        }
        confirmText={markingPaid ? 'Saving…' : 'Mark as paid'}
        cancelText="Cancel"
        type="warning"
      />

      {showInitialSpinner ? (
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-3xl font-bold text-dark-gray">Payments</h1>
              <p className="mt-1 text-sm text-gray-500">
                One row per member — pay pending <span className="font-medium">signup</span> first, then monthly installments.
              </p>
            </div>
            <PageHeaderActionsSkeleton />
          </div>
          <FilterBarSkeleton fields={2} />
          <TableSkeleton rows={10} columns={tableColumnCount} />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-3xl font-bold text-dark-gray">Payments</h1>
              <p className="mt-1 text-sm text-gray-500">
                One row per member — pay pending <span className="font-medium">signup</span> first, then monthly installments.
              </p>
              {statusFilter === 'overdue' && (
                <p className="mt-2 text-sm font-medium text-red-800">
                  Showing members whose next open installment is overdue.
                </p>
              )}
              {statusFilter === 'pending' && (
                <p className="mt-2 text-sm font-medium text-amber-900">
                  Showing members whose next open installment is pending or advance (not overdue yet).
                </p>
              )}
              {statusFilter === 'paid' && (
                <p className="mt-2 text-sm font-medium text-emerald-900">
                  Showing members with no next due on file (PAID for this list). Open-installments-only is off for this
                  view.
                </p>
              )}
            </div>
            <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={() => void handleExportExcel()}
                disabled={exporting}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {exporting ? 'Exporting…' : 'Export to Excel'}
              </button>
              {canPay && (
                <button
                  type="button"
                  onClick={handleCheckOverdue}
                  disabled={checkingOverdue}
                  className="w-full rounded-lg bg-orange px-4 py-2 text-white transition-colors hover:bg-orange-dark active:bg-orange-dark disabled:opacity-60 sm:w-auto"
                >
                  {checkingOverdue ? 'Checking…' : 'Check overdue'}
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
                onClick={() => refreshList()}
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
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative min-w-0 flex-1">
                    <input
                      type="text"
                      placeholder="Search by member ID / name, email, or phone…"
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
                    className="w-full rounded-lg bg-primary px-5 py-2 font-medium text-white hover:bg-primary-dark active:bg-primary-dark sm:w-auto"
                  >
                    Go
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark-gray">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilterAndUrl(e.target.value as PaymentStatusFilter)}
                    className="rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-dark-gray focus:border-transparent focus:ring-2 focus:ring-primary"
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="overdue">Overdue</option>
                    <option value="paid">PAID</option>
                  </select>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-dark-gray">
                  <input
                    type="checkbox"
                    checked={onlyOpenInput}
                    disabled={statusFilter === 'paid'}
                    onChange={(e) => setOnlyOpenInput(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                  />
                  Open installments only
                </label>
                <button
                  type="button"
                  onClick={handleApplyOpenFilter}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 sm:w-auto"
                >
                  Apply filter
                </button>
                {(searchQuery || onlyWithOpenInstallments || statusFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setSearchQuery('');
                      setOnlyOpenInput(false);
                      setOnlyWithOpenInstallments(false);
                      setStatusFilter('all');
                      setSortBy('nextDueDate');
                      setSortOrder('asc');
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
                    <th
                      className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-dark-gray hover:bg-gray-200"
                      onClick={() => handleSort('status')}
                    >
                      Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-dark-gray hover:bg-gray-200"
                      onClick={() => handleSort('overdueCount')}
                    >
                      Overdue months {sortBy === 'overdueCount' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    {canPay && (
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-dark-gray">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {tableRows.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={tableColumnCount} className="px-6 py-10 text-center text-gray-500">
                        {listError ? '—' : emptyMessage}
                      </td>
                    </tr>
                  ) : (
                    tableRows.map((row) => {
                      const nextBucket = row.nextUnpaid
                        ? uiBucketForNextUnpaid({
                            displayBucket: row.nextUnpaid.displayBucket,
                            dueDate: row.nextUnpaid.dueDate,
                            status: row.nextUnpaid.status,
                            isOverdue: row.nextUnpaid.isOverdue,
                          })
                        : null;
                      const canMarkRow =
                        row.nextUnpaid &&
                        (row.overdueMonthCount === 0 || nextBucket === 'overdue');
                      return (
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
                            <div className="flex items-center gap-3">
                              <MemberAvatar
                                name={row.member.name}
                                photoUrl={photoUrlFromMap(
                                  photoMap,
                                  row.member.id,
                                  row.member.photoUrl
                                )}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-dark-gray">{row.member.name}</div>
                                <div className="text-xs text-gray-500">
                                  ID: {displayMemberId(row.member)}
                                  {(row.member.phone || row.member.email) && (
                                    <span>
                                      {' · '}
                                      {row.member.phone || row.member.email}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                            {row.nextOneTime ? (
                              <div className="mb-1">
                                <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-800">
                                  Signup due
                                </span>
                                <div className="mt-1 font-medium text-violet-900">
                                  Rs. {row.nextOneTime.totalAmount.toFixed(2)}
                                </div>
                                {row.nextOneTime.admissionFee > 0 && (
                                  <div className="text-[10px] text-violet-700">
                                    Incl. admission Rs. {row.nextOneTime.admissionFee.toFixed(2)}
                                  </div>
                                )}
                              </div>
                            ) : null}
                            {row.nextUnpaid ? (
                              <div className={row.nextOneTime ? 'mt-2 border-t border-gray-100 pt-2' : ''}>
                                {row.nextOneTime ? (
                                  <div className="text-[10px] font-medium uppercase text-gray-400">Monthly</div>
                                ) : null}
                                <div>Rs. {row.nextUnpaid.amount.toFixed(2)}</div>
                                <div className="text-xs text-gray-500">{row.nextUnpaid.month}</div>
                              </div>
                            ) : !row.nextOneTime ? (
                              <span className="text-gray-500">—</span>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                            {row.nextOneTime ? (
                              <span className="text-violet-700">At signup</span>
                            ) : row.nextUnpaid ? (
                              formatDate(row.nextUnpaid.dueDate)
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            {row.nextOneTime ? (
                              <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">
                                SIGNUP
                              </span>
                            ) : !row.nextUnpaid ? (
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tailwindBadgeForUiBucket(
                                  'paid'
                                )}`}
                              >
                                PAID
                              </span>
                            ) : nextBucket ? (
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tailwindBadgeForUiBucket(
                                  nextBucket
                                )}`}
                              >
                                {nextBucket === 'overdue'
                                  ? 'OVERDUE'
                                  : nextBucket === 'pending'
                                    ? 'PENDING'
                                    : nextBucket === 'advance'
                                      ? 'ADVANCE'
                                      : uiLabelForBucket(nextBucket).toUpperCase()}
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
                          {canPay && (
                            <td className="whitespace-nowrap px-6 py-4 text-sm">
                              {row.nextOneTime ? (
                                <button
                                  type="button"
                                  disabled={markingPaid}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmOneTimeRow(row);
                                  }}
                                  className="rounded-lg bg-violet-600 px-3 py-1.5 font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                                >
                                  Mark signup paid
                                </button>
                              ) : row.nextUnpaid ? (
                                canMarkRow ? (
                                  <button
                                    type="button"
                                    disabled={markingPaid}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmPayRow(row);
                                    }}
                                    className="rounded-lg bg-green-600 px-3 py-1.5 font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                  >
                                    Mark paid
                                  </button>
                                ) : (
                                  <span
                                    className="text-xs text-gray-500"
                                    title="Clear all overdue installments before paying pending or advance months."
                                  >
                                    Pay overdues first
                                  </span>
                                )
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {(tableRows.length > 0 || loadingMore) && (
              <div
                ref={sentinelRef}
                className="flex flex-col items-center justify-center gap-2 border-t border-gray-100 px-4 py-4"
              >
                {loadingMore && <Loading inline size="sm" message="Loading more…" />}
                {!loadingMore && tableRows.length > 0 && (
                  <p className="text-sm text-gray-500">
                    {pagination.hasMore
                      ? `Showing ${tableRows.length} of ${pagination.total} members`
                      : pagination.total > 0
                        ? `All ${pagination.total} members loaded`
                        : `${tableRows.length} members`}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense
      fallback={
        <Layout>
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-dark-gray">Payments</h1>
              <p className="mt-1 text-sm text-gray-500">
                One row per member — pay pending signup first, then monthly installments.
              </p>
            </div>
            <FilterBarSkeleton fields={2} />
            <TableSkeleton rows={10} columns={6} />
          </div>
        </Layout>
      }
    >
      <PaymentsPageContent />
    </Suspense>
  );
}

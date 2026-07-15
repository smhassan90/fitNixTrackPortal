'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import Alert from '@/components/Alert';
import Loading from '@/components/Loading';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/dateUtils';
import { useAlert } from '@/hooks/useAlert';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errorHandler';
import { canManageGymPayments } from '@/lib/gymRoles';
import { printPaymentReceipt } from '@/lib/paymentReceipt';
import { displayMemberId, normalizeMemberNumberFields } from '@/lib/displayMemberId';
import {
  printReceiptForPaymentRecord,
  receiptPrintedByFromUser,
  resolvePaymentIdAfterMarkPaid,
  tryPrintMonthlyReceiptAfterMarkPaid,
  type PrintablePaymentRecord,
} from '@/lib/paymentReceiptUrl';
import { notifyDashboardStatsRefresh } from '@/lib/dashboardEvents';
import { postMarkProjectedMonthPaid } from '@/lib/markProjectedMonthPaidApi';
import { mergeWithProjectedAdvanceMonths } from '@/lib/projectedMonthlyInstallments';
import {
  isInstallmentUnpaid,
  uiBucketForInstallment,
  uiLabelForBucket,
  type InstallmentUiBucket,
} from '@/lib/monthlyInstallmentUi';
import {
  bulkSelectableUnpaid,
  canSelectInstallmentForBulk,
  getBulkPayBlockReason,
  getPayBlockReason,
  hasUnpaidOverdue,
  installmentKey,
} from '@/lib/paymentPayOrder';
import {
  hasPendingSignupOneTime,
  normalizePendingOneTime,
  SIGNUP_PAY_BLOCK_MESSAGE,
  withResolvedAdmissionFee,
  type PendingOneTimePayment,
} from '@/lib/signupFees';

type InstallmentStatus = 'PENDING' | 'OVERDUE' | 'PAID' | string;

interface MonthlyInstallment {
  id: string;
  memberId?: string;
  month: string;
  amount: number;
  status: InstallmentStatus;
  dueDate: string;
  paidDate: string | null;
  /** Server-computed using GYM_TIMEZONE; prefer over client inference. */
  displayBucket?: string | null;
  member?: {
    id: string;
    memberNumber?: string | null;
    legacyMemberId?: string | null;
    name: string;
    phone: string | null;
    email: string | null;
  };
  /** Filled only by mergeWithProjectedAdvanceMonths when API omits future months. */
  isProjected?: boolean;
}

interface MemberStatusLite {
  id: string;
  memberNumber: string | null;
  legacyMemberId: string | null;
  name: string;
  isActive?: boolean;
  inactiveFrom?: string | null;
  billingResumeFrom?: string | null;
}

interface OneTimePaymentRecord {
  id: number;
  type: 'one-time';
  admissionFee: number;
  packageFee: number;
  trainerFee: number;
  totalAmount: number;
  status: string;
  paidDate: string | null;
  createdAt: string;
  receiptPath?: string;
}

function normalizeOneTimePaymentRecord(raw: Record<string, unknown>): OneTimePaymentRecord | null {
  const id = Number(raw.id);
  if (!id || Number.isNaN(id)) return null;
  if (raw.type != null && String(raw.type) !== 'one-time') return null;
  return {
    id,
    type: 'one-time',
    admissionFee: Number(raw.admissionFee) || 0,
    packageFee: Number(raw.packageFee) || 0,
    trainerFee: Number(raw.trainerFee) || 0,
    totalAmount: Number(raw.totalAmount) || 0,
    status: String(raw.status ?? ''),
    paidDate: raw.paidDate != null ? String(raw.paidDate) : null,
    createdAt: String(raw.createdAt ?? ''),
    receiptPath: raw.receiptPath != null ? String(raw.receiptPath) : undefined,
  };
}

type MemberStatusActionKind = 'deactivate' | 'reactivate';
type DateMode = 'today' | 'custom';

function normalizeInstallment(raw: Record<string, unknown>): MonthlyInstallment {
  const m = raw.member as MonthlyInstallment['member'] | undefined;
  const nums = m ? normalizeMemberNumberFields(m as unknown as Record<string, unknown>) : null;
  return {
    ...raw,
    id: String(raw.id ?? ''),
    memberId: raw.memberId != null ? String(raw.memberId) : undefined,
    amount: Number(raw.amount) || 0,
    status: String(raw.status ?? ''),
    dueDate: String(raw.dueDate ?? ''),
    month: String(raw.month ?? ''),
    displayBucket: raw.displayBucket != null ? String(raw.displayBucket) : undefined,
    paidDate: raw.paidDate != null ? String(raw.paidDate) : null,
    member: m
      ? {
          ...m,
          id: String(m.id),
          memberNumber: nums?.memberNumber ?? m.memberNumber ?? null,
          legacyMemberId: nums?.legacyMemberId ?? m.legacyMemberId ?? null,
        }
      : m,
  } as MonthlyInstallment;
}

function sortByDueDate(a: MonthlyInstallment, b: MonthlyInstallment) {
  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
}

export default function MemberPaymentsDetailPage() {
  const params = useParams();
  const memberId = String(params.id ?? '');
  const { user } = useAuth();
  const { alert, showAlert, closeAlert } = useAlert();
  const canPay = canManageGymPayments(user?.role);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string>('');
  const [memberStatus, setMemberStatus] = useState<MemberStatusLite | null>(null);
  const [monthlyInstallments, setMonthlyInstallments] = useState<MonthlyInstallment[]>([]);
  const [pendingOneTime, setPendingOneTime] = useState<PendingOneTimePayment | null>(null);
  const [oneTimeHistory, setOneTimeHistory] = useState<OneTimePaymentRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [singleConfirm, setSingleConfirm] = useState<MonthlyInstallment | null>(null);
  const [oneTimeConfirm, setOneTimeConfirm] = useState(false);
  const [unpaidConfirm, setUnpaidConfirm] = useState<MonthlyInstallment | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusDateMode, setStatusDateMode] = useState<DateMode>('today');
  const [statusCustomDate, setStatusCustomDate] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!memberId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/api/members/${memberId}/payments?type=all`);
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || 'Failed to load payments');
      }
      const data = response.data.data || {};
      const normalizedOneTime = normalizePendingOneTime(data.pendingOneTime);
      setPendingOneTime(normalizedOneTime ? withResolvedAdmissionFee(normalizedOneTime) : null);
      const paymentRows = Array.isArray(data.payments) ? (data.payments as Record<string, unknown>[]) : [];
      setOneTimeHistory(
        paymentRows
          .map(normalizeOneTimePaymentRecord)
          .filter((row): row is OneTimePaymentRecord => row != null)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
      const timeline = (data.monthlyInstallments || []) as Record<string, unknown>[];
      const normalized = timeline.map(normalizeInstallment).sort(sortByDueDate);
      const withProjected = mergeWithProjectedAdvanceMonths(normalized, { horizonMonthsFromToday: 12 });
      setMonthlyInstallments(withProjected);

      const nameFromPayload =
        data.member?.name ||
        normalized[0]?.member?.name ||
        (data.memberName as string) ||
        '';
      if (nameFromPayload) setMemberName(nameFromPayload);
      else {
        try {
          const mRes = await api.get(`/api/members/${memberId}`);
          if (mRes.data?.success && mRes.data.data?.member?.name) {
            setMemberName(mRes.data.data.member.name);
            const m = mRes.data.data.member as Record<string, unknown>;
            setMemberStatus({
              id: String(m.id ?? memberId),
              ...normalizeMemberNumberFields(m),
              name: String(m.name ?? ''),
              isActive: m.isActive !== false,
              inactiveFrom: m.inactiveFrom != null ? String(m.inactiveFrom) : null,
              billingResumeFrom: m.billingResumeFrom != null ? String(m.billingResumeFrom) : null,
            });
          }
        } catch {
          /* optional */
        }
      }
      if (data.member) {
        const m = data.member as Record<string, unknown>;
        setMemberStatus({
          id: String(m.id ?? memberId),
          ...normalizeMemberNumberFields(m),
          name: String(m.name ?? nameFromPayload ?? ''),
          isActive: m.isActive !== false,
          inactiveFrom: m.inactiveFrom != null ? String(m.inactiveFrom) : null,
          billingResumeFrom: m.billingResumeFrom != null ? String(m.billingResumeFrom) : null,
        });
      }
    } catch (e: unknown) {
      const msg = getErrorMessage(e);
      setError(msg);
      showAlert('error', 'Error', msg);
    } finally {
      setLoading(false);
    }
  }, [memberId, showAlert]);

  useEffect(() => {
    setSelectedIds(new Set());
    fetchDetail();
  }, [fetchDetail]);

  /**
   * Sections follow API displayBucket per row (gym TZ on server). Falls back to browser-local rules only if displayBucket is missing.
   * Order: Overdue → Pending → Advance → Paid (same as monthlyGrouped).
   */
  const grouped = useMemo(() => {
    const paid: MonthlyInstallment[] = [];
    const overdue: MonthlyInstallment[] = [];
    const pending: MonthlyInstallment[] = [];
    const advance: MonthlyInstallment[] = [];

    for (const i of monthlyInstallments) {
      if (i.status === 'PAID') {
        paid.push(i);
        continue;
      }
      switch (uiBucketForInstallment(i)) {
        case 'overdue':
          overdue.push(i);
          break;
        case 'pending':
          pending.push(i);
          break;
        case 'advance':
          advance.push(i);
          break;
        default:
          pending.push(i);
      }
    }

    return {
      paid: paid.sort(sortByDueDate),
      overdue: overdue.sort(sortByDueDate),
      pending: pending.sort(sortByDueDate),
      advance: advance.sort(sortByDueDate),
    };
  }, [monthlyInstallments]);

  const openBucketsAllEmpty =
    grouped.overdue.length === 0 &&
    grouped.pending.length === 0 &&
    grouped.advance.length === 0;

  const signupBlocksMonthly = hasPendingSignupOneTime(pendingOneTime);
  const payOrderOptions = useMemo(
    () => ({ pendingSignupOneTime: signupBlocksMonthly }),
    [signupBlocksMonthly]
  );

  const selectableUnpaid = useMemo(
    () => bulkSelectableUnpaid(monthlyInstallments, payOrderOptions),
    [monthlyInstallments, payOrderOptions]
  );

  const overdueBlocksPending = useMemo(
    () => hasUnpaidOverdue(monthlyInstallments),
    [monthlyInstallments]
  );

  const hasProjectedRows = useMemo(
    () => monthlyInstallments.some((i) => i.isProjected),
    [monthlyInstallments]
  );

  /** LIFO undo: only the paid row with the latest due date (then id) may be reverted per API rules. */
  const latestPaidForUndo = useMemo(() => {
    const paid = monthlyInstallments.filter((i) => i.status === 'PAID' && !i.isProjected);
    if (paid.length === 0) return null;
    return [...paid].sort((a, b) => {
      const da = new Date(a.dueDate).getTime();
      const db = new Date(b.dueDate).getTime();
      if (db !== da) return db - da;
      const na = Number(a.id);
      const nb = Number(b.id);
      if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return nb - na;
      return String(b.id).localeCompare(String(a.id));
    })[0];
  }, [monthlyInstallments]);

  const toggleSelect = (key: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllUnpaid = () => {
    const all = new Set(selectableUnpaid.map((i) => installmentKey(i)));
    setSelectedIds(all);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkMarkPaid = async () => {
    const keys = Array.from(selectedIds);
    if (keys.length === 0) {
      showAlert('warning', 'Nothing selected', 'Select at least one unpaid installment.');
      return;
    }
    const selected = keys
      .map((key) => monthlyInstallments.find((i) => installmentKey(i) === key))
      .filter((i): i is MonthlyInstallment => Boolean(i));
    const bulkBlock = getBulkPayBlockReason(selected, monthlyInstallments, payOrderOptions);
    if (bulkBlock) {
      showAlert('warning', 'Pay in order', bulkBlock);
      return;
    }
    try {
      setBulkSubmitting(true);

      const projected = selected.filter((i) => i.isProjected);
      const real = selected.filter((i) => !i.isProjected);

      for (const p of projected) {
        await postMarkProjectedMonthPaid({
          memberId,
          billingMonth: p.month,
          amount: p.amount,
          dueDate: p.dueDate,
        });
      }

      if (real.length > 0) {
        const paymentIds = real.map((i) => Number(i.id)).filter((n) => !Number.isNaN(n));
        if (paymentIds.length !== real.length) {
          throw new Error('Some selected rows have invalid payment IDs.');
        }
        const response = await api.post('/api/payments/bulk-mark-paid', { paymentIds });
        if (!response.data?.success) {
          throw new Error(response.data?.error?.message || 'Bulk mark paid failed');
        }
      }

      showAlert('success', 'Payments recorded', `${keys.length} installment(s) marked as paid.`);
      clearSelection();
      notifyDashboardStatsRefresh();
      await fetchDetail();
    } catch (e: unknown) {
      showAlert('error', 'Error', getErrorMessage(e));
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleMarkOneTimePaid = async () => {
    if (!pendingOneTime?.id) return;
    const oneTimeId = pendingOneTime.id;
    try {
      setBulkSubmitting(true);
      const response = await api.patch(`/api/payments/one-time/${oneTimeId}/mark-paid`);
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || 'Mark paid failed');
      }
      showAlert('success', 'Signup payment recorded', 'Signup one-time payment marked as paid.');
      setOneTimeConfirm(false);
      notifyDashboardStatsRefresh();
      await fetchDetail();
      try {
        await printReceiptForPaymentRecord(
          { type: 'one-time', id: oneTimeId },
          receiptPrintedByFromUser(user),
          memberId
        );
      } catch (printErr) {
        console.warn('Signup receipt print failed:', printErr);
        showAlert(
          'warning',
          'Receipt',
          'Payment saved. Allow popups to print the receipt.'
        );
      }
    } catch (e: unknown) {
      showAlert('error', 'Error', getErrorMessage(e));
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleSingleMarkPaid = async (inst: MonthlyInstallment) => {
    const blockReason = getPayBlockReason(inst, monthlyInstallments, payOrderOptions);
    if (blockReason) {
      showAlert('warning', 'Pay in order', blockReason);
      setSingleConfirm(null);
      return;
    }
    const wasProjected = Boolean(inst.isProjected);
    const billingMonth = inst.month;
    try {
      setBulkSubmitting(true);
      if (wasProjected) {
        await postMarkProjectedMonthPaid({
          memberId,
          billingMonth: inst.month,
          amount: inst.amount,
          dueDate: inst.dueDate,
        });
      } else {
        const response = await api.patch(`/api/payments/${inst.id}/mark-paid`);
        if (!response.data?.success) {
          throw new Error(response.data?.error?.message || 'Mark paid failed');
        }
      }
      showAlert('success', 'Payment recorded', 'Installment marked as paid.');
      setSingleConfirm(null);
      notifyDashboardStatsRefresh();
      await fetchDetail();
      try {
        const paymentId = await resolvePaymentIdAfterMarkPaid({
          memberId,
          month: billingMonth,
          existingId: inst.id,
          wasProjected,
        });
        if (paymentId != null) {
          await tryPrintMonthlyReceiptAfterMarkPaid({
            paymentId,
            memberId,
            printedBy: receiptPrintedByFromUser(user),
          });
        }
      } catch (printErr) {
        console.warn('Receipt print failed:', printErr);
        showAlert(
          'warning',
          'Receipt',
          'Payment saved. Allow popups to print the receipt.'
        );
      }
    } catch (e: unknown) {
      showAlert('error', 'Error', getErrorMessage(e));
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleMarkUnpaid = async (inst: MonthlyInstallment) => {
    try {
      setBulkSubmitting(true);
      const response = await api.patch(`/api/payments/${inst.id}/mark-unpaid`);
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || 'Could not mark unpaid');
      }
      showAlert('success', 'Payment undone', 'Installment is unpaid again.');
      setUnpaidConfirm(null);
      await fetchDetail();
    } catch (e: unknown) {
      showAlert('error', 'Error', getErrorMessage(e));
    } finally {
      setBulkSubmitting(false);
    }
  };

  const getBucketColor = (bucket: InstallmentUiBucket) => {
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
  };

  const handlePrintReceipt = async (payment: MonthlyInstallment) => {
    if (payment.status !== 'PAID') {
      showAlert('warning', 'Cannot print receipt', 'Receipts are only available for paid installments.');
      return;
    }
    if (!payment.id) {
      showAlert('error', 'Print error', 'This installment has no payment ID yet.');
      return;
    }
    try {
      await printPaymentReceipt(payment.id, receiptPrintedByFromUser(user), memberId);
    } catch (e: unknown) {
      showAlert('error', 'Print error', getErrorMessage(e));
    }
  };

  const handlePrintOneTimeReceipt = async (record: PrintablePaymentRecord) => {
    try {
      await printReceiptForPaymentRecord(
        record,
        receiptPrintedByFromUser(user),
        memberId
      );
    } catch (e: unknown) {
      showAlert('error', 'Print error', getErrorMessage(e));
    }
  };

  const paidOneTimeHistory = useMemo(
    () => oneTimeHistory.filter((row) => row.status === 'PAID'),
    [oneTimeHistory]
  );

  const currentStatusAction: MemberStatusActionKind =
    memberStatus?.isActive === false ? 'reactivate' : 'deactivate';

  const submitMemberStatusAction = async () => {
    if (!memberStatus || statusSubmitting) return;
    const isCustom = statusDateMode === 'custom';
    if (isCustom) {
      const valid = /^\d{4}-\d{2}-\d{2}$/.test(statusCustomDate) && !Number.isNaN(new Date(`${statusCustomDate}T00:00:00`).getTime());
      if (!valid) {
        showAlert('warning', 'Invalid date', 'Enter date in YYYY-MM-DD format.');
        return;
      }
    }
    try {
      setStatusSubmitting(true);
      const endpoint = currentStatusAction === 'deactivate' ? 'deactivate' : 'reactivate';
      const body = isCustom ? { effectiveDate: statusCustomDate } : {};
      const response = await api.patch(`/api/members/${memberId}/${endpoint}`, body);
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || `Could not ${currentStatusAction} member`);
      }
      showAlert(
        'success',
        currentStatusAction === 'deactivate' ? 'Member deactivated' : 'Member reactivated',
        `${memberStatus.name || 'Member'} status updated successfully.`
      );
      setStatusDialogOpen(false);
      setStatusDateMode('today');
      setStatusCustomDate('');
      await fetchDetail();
      try {
        await api.get('/api/payments/member-summaries?onlyWithOpenInstallments=true&limit=1&page=1');
      } catch {
        /* best-effort */
      }
    } catch (e: unknown) {
      showAlert('error', 'Error', getErrorMessage(e));
    } finally {
      setStatusSubmitting(false);
    }
  };

  const renderSection = (
    title: string,
    items: MonthlyInstallment[],
    showSelect: boolean,
    undoPaidId: string | null = null
  ) => {
    if (items.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-6 text-center text-sm text-gray-500">
          No {title.toLowerCase()} installments.
        </div>
      );
    }
    return (
      <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-light-gray">
            <tr>
              {showSelect && canPay && (
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray w-12"> </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Month</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Due</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Status</th>
              {canPay && (
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {items.map((row) => {
              const bucket = uiBucketForInstallment(row);
              const rowKey = installmentKey(row);
              const payBlockReason = getPayBlockReason(row, monthlyInstallments, payOrderOptions);
              const canPayRow = row.status !== 'PAID' && payBlockReason === null;
              const canSelect =
                showSelect &&
                isInstallmentUnpaid(row) &&
                canSelectInstallmentForBulk(row, monthlyInstallments, selectedIds, payOrderOptions);
              return (
                <tr key={rowKey} className="hover:bg-gray-50/80">
                  {showSelect && canPay && (
                    <td className="px-4 py-3">
                      {canSelect ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(rowKey)}
                          onChange={() => toggleSelect(rowKey)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      ) : (
                        <span className="inline-block w-4" />
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {row.month}
                    {row.isProjected && (
                      <span className="ml-2 text-xs font-normal text-gray-400">(projected)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">Rs. {row.amount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(row.dueDate)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getBucketColor(bucket)}`}
                    >
                      {uiLabelForBucket(bucket)}
                    </span>
                  </td>
                  {canPay && (
                    <td className="px-4 py-3 text-sm">
                      {row.status !== 'PAID' ? (
                        canPayRow ? (
                          <button
                            type="button"
                            onClick={() => setSingleConfirm(row)}
                            className="rounded-lg bg-green-600 px-3 py-1.5 font-medium text-white hover:bg-green-700"
                          >
                            Mark paid
                          </button>
                        ) : (
                          <span
                            className="text-xs text-gray-500"
                            title={payBlockReason ?? undefined}
                          >
                            {signupBlocksMonthly ? 'Pay signup first' : 'Pay earlier months first'}
                          </span>
                        )
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handlePrintReceipt(row)}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-gray-800 hover:bg-gray-50"
                          >
                            Receipt
                          </button>
                          {undoPaidId === row.id && (
                            <button
                              type="button"
                              disabled={bulkSubmitting}
                              onClick={() => setUnpaidConfirm(row)}
                              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                            >
                              Undo payment
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading && monthlyInstallments.length === 0 && !error) {
    return (
      <Layout>
        <Loading message="Loading member payments..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <Alert isOpen={alert.isOpen} onClose={closeAlert} type={alert.type} title={alert.title} message={alert.message} />
      <ConfirmationDialog
        isOpen={oneTimeConfirm}
        onClose={() => setOneTimeConfirm(false)}
        onConfirm={() => void handleMarkOneTimePaid()}
        title="Mark signup payment as paid"
        message={
          pendingOneTime
            ? `Mark signup payment of Rs. ${pendingOneTime.totalAmount.toFixed(2)} as paid?`
            : ''
        }
        confirmText="Mark signup paid"
        cancelText="Cancel"
        type="warning"
      />
      <ConfirmationDialog
        isOpen={!!singleConfirm}
        onClose={() => setSingleConfirm(null)}
        onConfirm={() => singleConfirm && handleSingleMarkPaid(singleConfirm)}
        title="Mark installment as paid"
        message={
          singleConfirm
            ? `Mark Rs. ${singleConfirm.amount.toFixed(2)} for ${singleConfirm.month} as paid?`
            : ''
        }
        confirmText="Mark as paid"
        cancelText="Cancel"
        type="warning"
      />
      <ConfirmationDialog
        isOpen={!!unpaidConfirm}
        onClose={() => setUnpaidConfirm(null)}
        onConfirm={() => unpaidConfirm && void handleMarkUnpaid(unpaidConfirm)}
        title="Undo this payment?"
        message={
          unpaidConfirm
            ? `Mark ${unpaidConfirm.month} as unpaid again? Only the most recently paid installment can be undone. If this fails, mark a newer payment unpaid first.`
            : ''
        }
        confirmText="Mark unpaid"
        cancelText="Cancel"
        type="warning"
      />
      {statusDialogOpen && memberStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/35" onClick={() => !statusSubmitting && setStatusDialogOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-dark-gray">
              {currentStatusAction === 'deactivate' ? 'Deactivate member' : 'Reactivate member'}
            </h3>
            <p className="mt-1 text-sm text-gray-600">{memberStatus.name}</p>
            <div className="mt-4 space-y-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="memberStatusDateMode" checked={statusDateMode === 'today'} onChange={() => setStatusDateMode('today')} />
                Effective from today
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="memberStatusDateMode" checked={statusDateMode === 'custom'} onChange={() => setStatusDateMode('custom')} />
                Custom effective date
              </label>
              <input
                type="date"
                disabled={statusDateMode !== 'custom' || statusSubmitting}
                value={statusCustomDate}
                onChange={(e) => setStatusCustomDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:opacity-50"
              />
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setStatusDialogOpen(false)}
                disabled={statusSubmitting}
                className="flex-1 rounded-lg bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitMemberStatusAction}
                disabled={statusSubmitting}
                className="flex-1 rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {statusSubmitting ? 'Saving…' : currentStatusAction === 'deactivate' ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/payments" className="text-sm font-medium text-primary hover:underline">
              ← Back to payments
            </Link>
            <h1 className="mt-2 text-3xl font-bold text-dark-gray">{memberName || 'Member payments'}</h1>
            {memberStatus && displayMemberId(memberStatus) !== '—' && (
              <p className="mt-1 text-sm text-gray-500">
                Member ID: <span className="font-medium text-dark-gray">{displayMemberId(memberStatus)}</span>
              </p>
            )}
            {memberStatus && (
              <div className="mt-2 space-y-1 text-sm">
                <div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                      memberStatus.isActive === false
                        ? 'bg-red-100 text-red-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {memberStatus.isActive === false ? 'Inactive' : 'Active'}
                  </span>
                </div>
                {memberStatus.inactiveFrom && (
                  <p className="text-gray-600">Inactive from: {formatDate(memberStatus.inactiveFrom)}</p>
                )}
                {memberStatus.billingResumeFrom && (
                  <p className="text-gray-600">Resumed billing: {formatDate(memberStatus.billingResumeFrom)}</p>
                )}
              </div>
            )}
            {signupBlocksMonthly && (
              <p className="mt-2 max-w-2xl rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
                {SIGNUP_PAY_BLOCK_MESSAGE}
              </p>
            )}
            {overdueBlocksPending && !signupBlocksMonthly && (
              <p className="mt-2 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Clear all <span className="font-medium">overdue</span> installments before paying pending or advance
                months.
              </p>
            )}
            {hasProjectedRows && (
              <p className="mt-2 max-w-2xl text-sm text-gray-500">
                <span className="font-medium">(projected)</span> is the next billing month when your system has not
                returned that row yet. Mark paid records it using your gym API (member + billing month).
              </p>
            )}
          </div>
          {canPay && selectableUnpaid.length > 0 && !signupBlocksMonthly && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={statusSubmitting || !memberStatus}
                onClick={() => {
                  setStatusDateMode('today');
                  setStatusCustomDate('');
                  setStatusDialogOpen(true);
                }}
                className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
              >
                {memberStatus?.isActive === false ? 'Reactivate Member' : 'Deactivate Member'}
              </button>
              <button
                type="button"
                onClick={selectAllUnpaid}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-dark-gray hover:bg-gray-50"
              >
                Select {overdueBlocksPending ? 'all overdue' : 'all unpaid'}
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-dark-gray hover:bg-gray-50"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={bulkSubmitting || selectedIds.size === 0}
                onClick={handleBulkMarkPaid}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bulkSubmitting ? 'Saving…' : `Mark paid (${selectedIds.size})`}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <p className="font-medium">Could not load payments</p>
            <p className="text-sm">{error}</p>
            <button
              type="button"
              onClick={() => fetchDetail()}
              className="mt-3 rounded-lg bg-red-700 px-3 py-1.5 text-sm text-white hover:bg-red-800"
            >
              Retry
            </button>
          </div>
        )}

        {loading && monthlyInstallments.length > 0 && (
          <p className="text-sm text-gray-500">Refreshing…</p>
        )}

        {pendingOneTime && (
          <section className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-violet-950">Signup / one-time payment</h2>
                <p className="mt-1 text-sm text-violet-800">Pay this before monthly installments.</p>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-4 rounded-md bg-white/80 px-3 py-2 sm:col-span-2">
                    <dt className="font-medium text-violet-900">Admission fee</dt>
                    <dd className="font-semibold text-gray-900">
                      {pendingOneTime.admissionFee > 0
                        ? `Rs. ${pendingOneTime.admissionFee.toFixed(2)}`
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 rounded-md bg-white/80 px-3 py-2">
                    <dt className="text-gray-600">Package (1st month)</dt>
                    <dd className="font-medium text-gray-900">Rs. {pendingOneTime.packageFee.toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 rounded-md bg-white/80 px-3 py-2">
                    <dt className="text-gray-600">Trainer fee</dt>
                    <dd className="font-medium text-gray-900">Rs. {pendingOneTime.trainerFee.toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 rounded-md border border-violet-200 bg-white px-3 py-2">
                    <dt className="font-semibold text-violet-900">Total</dt>
                    <dd className="font-bold text-violet-900">Rs. {pendingOneTime.totalAmount.toFixed(2)}</dd>
                  </div>
                </dl>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                {canPay && pendingOneTime.status === 'PENDING' && (
                  <button
                    type="button"
                    disabled={bulkSubmitting}
                    onClick={() => setOneTimeConfirm(true)}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    Mark signup paid
                  </button>
                )}
                <button
                  type="button"
                  disabled={bulkSubmitting}
                  onClick={() =>
                    void handlePrintOneTimeReceipt({ type: 'one-time', id: pendingOneTime.id })
                  }
                  className="rounded-lg border border-violet-300 bg-white px-4 py-2 text-sm font-medium text-violet-800 hover:bg-violet-50"
                >
                  Print receipt
                </button>
              </div>
            </div>
          </section>
        )}

        {paidOneTimeHistory.length > 0 && (
          <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-dark-gray">Signup payment history</h2>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-light-gray">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Breakdown</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {paidOneTimeHistory.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/80">
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(row.paidDate || row.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div>Admission: Rs. {row.admissionFee.toFixed(2)}</div>
                        <div>Package: Rs. {row.packageFee.toFixed(2)}</div>
                        <div>Trainer: Rs. {row.trainerFee.toFixed(2)}</div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">Rs. {row.totalAmount.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          type="button"
                          onClick={() =>
                            void handlePrintOneTimeReceipt({
                              type: row.type,
                              id: row.id,
                              receiptPath: row.receiptPath,
                            })
                          }
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-gray-800 hover:bg-gray-50"
                        >
                          Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div className={signupBlocksMonthly ? 'pointer-events-none space-y-6 opacity-50' : 'space-y-6'}>
        {monthlyInstallments.length > 0 && (
          <h2 className="text-lg font-semibold text-dark-gray">Monthly installments</h2>
        )}
        {monthlyInstallments.length === 0 && !loading && !error && !pendingOneTime ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-gray-500">
            No monthly installment history for this member.
          </div>
        ) : (
          <>
            {openBucketsAllEmpty ? (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-dark-gray">Open installments</h2>
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-6 text-center text-sm text-gray-500">
                  No overdue, pending, or advance rows in the current response.
                </div>
              </section>
            ) : (
              <>
                {grouped.overdue.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="text-lg font-semibold text-dark-gray">Overdue</h2>
                    {renderSection('overdue', grouped.overdue, true)}
                  </section>
                )}
                {grouped.pending.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="text-lg font-semibold text-dark-gray">Pending</h2>
                    {renderSection('pending', grouped.pending, true)}
                  </section>
                )}
                {grouped.advance.length > 0 && (
                  <section className="space-y-3">
                    <h2 className="text-lg font-semibold text-dark-gray">Advance</h2>
                    {renderSection('advance', grouped.advance, true)}
                  </section>
                )}
              </>
            )}

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-dark-gray">Paid</h2>
              {renderSection('paid', grouped.paid, false, latestPaidForUndo?.id ?? null)}
            </section>
          </>
        )}
        </div>
      </div>
    </Layout>
  );
}

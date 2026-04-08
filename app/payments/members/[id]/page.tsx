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
import { postMarkProjectedMonthPaid } from '@/lib/markProjectedMonthPaidApi';
import { mergeWithProjectedAdvanceMonths } from '@/lib/projectedMonthlyInstallments';
import {
  isInstallmentUnpaid,
  uiBucketForInstallment,
  uiLabelForBucket,
  type InstallmentUiBucket,
} from '@/lib/monthlyInstallmentUi';

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
  member?: { id: string; name: string; phone: string | null; email: string | null };
  /** Filled only by mergeWithProjectedAdvanceMonths when API omits future months. */
  isProjected?: boolean;
}

interface MemberStatusLite {
  id: string;
  name: string;
  isActive?: boolean;
  inactiveFrom?: string | null;
  billingResumeFrom?: string | null;
}

type MemberStatusActionKind = 'deactivate' | 'reactivate';
type DateMode = 'today' | 'custom';

function normalizeInstallment(raw: Record<string, unknown>): MonthlyInstallment {
  const m = raw.member as MonthlyInstallment['member'] | undefined;
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string>('');
  const [memberStatus, setMemberStatus] = useState<MemberStatusLite | null>(null);
  const [monthlyInstallments, setMonthlyInstallments] = useState<MonthlyInstallment[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [singleConfirm, setSingleConfirm] = useState<MonthlyInstallment | null>(null);
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
      const response = await api.get(`/api/members/${memberId}/payments?type=monthly`);
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || 'Failed to load payments');
      }
      const data = response.data.data || {};
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

  const selectableUnpaid = useMemo(() => {
    return monthlyInstallments.filter((i) => isInstallmentUnpaid(i));
  }, [monthlyInstallments]);

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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllUnpaid = () => {
    const all = new Set(selectableUnpaid.map((i) => i.id));
    setSelectedIds(all);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkMarkPaid = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      showAlert('warning', 'Nothing selected', 'Select at least one unpaid installment.');
      return;
    }
    try {
      setBulkSubmitting(true);
      const selected = ids
        .map((id) => monthlyInstallments.find((i) => i.id === id))
        .filter((i): i is MonthlyInstallment => Boolean(i));

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

      showAlert('success', 'Payments recorded', `${ids.length} installment(s) marked as paid.`);
      clearSelection();
      await fetchDetail();
    } catch (e: unknown) {
      showAlert('error', 'Error', getErrorMessage(e));
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleSingleMarkPaid = async (inst: MonthlyInstallment) => {
    try {
      setBulkSubmitting(true);
      if (inst.isProjected) {
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
      await fetchDetail();
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
    let packageInfo: { name: string; price: number; discount?: number | null; duration?: string } | null = null;
    let originalAmount = payment.amount;
    let discountAmount = 0;
    try {
      const memberResponse = await api.get(`/api/members/${memberId}`);
      if (memberResponse.data.success && memberResponse.data.data.member) {
        const member = memberResponse.data.data.member;
        if (member.packageId) {
          const packageResponse = await api.get(`/api/packages/${member.packageId}`);
          if (packageResponse.data.success && packageResponse.data.data.package) {
            packageInfo = packageResponse.data.data.package;
            if (packageInfo) {
              const packagePrice = packageInfo.price;
              const packageDiscount = packageInfo.discount || 0;
              const isAnnual = packageInfo.duration?.includes('12') || false;
              let monthlyBase = isAnnual ? packagePrice / 12 : packagePrice;
              if (packageDiscount > 0) {
                if (isAnnual) {
                  monthlyBase = (packagePrice - packageDiscount) / 12;
                  discountAmount = packageDiscount / 12;
                } else {
                  monthlyBase = packagePrice - packageDiscount;
                  discountAmount = packageDiscount;
                }
              }
              originalAmount = isAnnual ? packagePrice / 12 : packagePrice;
            }
          }
        }
      }
    } catch {
      /* continue */
    }

    const displayName = memberName || payment.member?.name || 'Member';
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Receipt - ${displayName}</title>
          <style>
            @media print { @page { margin: 20mm; } }
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; border-bottom: 3px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
            .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .amount-section { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 30px 0; }
            .amount-row { display: flex; justify-content: space-between; font-size: 18px; margin: 10px 0; }
            .total { font-size: 24px; font-weight: bold; border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; }
            .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
            .status-badge { display: inline-block; padding: 5px 15px; background: #10b981; color: white; border-radius: 20px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header"><h1>FitNixTrack Gym</h1><p>Payment Receipt</p></div>
          <div class="info-row"><span><strong>Receipt #</strong></span><span>${payment.id}</span></div>
          <div class="info-row"><span><strong>Date</strong></span><span>${formatDate(payment.paidDate || payment.dueDate)}</span></div>
          <div class="info-row"><span><strong>Member</strong></span><span>${displayName}</span></div>
          <div class="info-row"><span><strong>Month</strong></span><span>${payment.month}</span></div>
          <div class="info-row"><span><strong>Status</strong></span><span><span class="status-badge">PAID</span></span></div>
          <div class="amount-section">
            ${packageInfo && discountAmount > 0 ? `<div class="amount-row"><span>Package</span><span>${packageInfo.name}</span></div>` : ''}
            <div class="amount-row total"><span>Total Paid</span><span>Rs. ${payment.amount.toFixed(2)}</span></div>
          </div>
          <div class="footer"><p>Thank you for your payment!</p></div>
        </body>
      </html>
    `;
    const blob = new Blob([receiptHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    if (!printWindow) {
      showAlert('error', 'Print error', 'Allow popups to print receipts.');
      URL.revokeObjectURL(url);
      return;
    }
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        URL.revokeObjectURL(url);
      }, 250);
    };
  };

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
              {showSelect && user?.role === 'GYM_ADMIN' && (
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray w-12"> </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Month</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Due</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Status</th>
              {user?.role === 'GYM_ADMIN' && (
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {items.map((row) => {
              const bucket = uiBucketForInstallment(row);
              const canSelect = showSelect && isInstallmentUnpaid(row);
              return (
                <tr key={row.id} className="hover:bg-gray-50/80">
                  {showSelect && user?.role === 'GYM_ADMIN' && (
                    <td className="px-4 py-3">
                      {canSelect ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleSelect(row.id)}
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
                  {user?.role === 'GYM_ADMIN' && (
                    <td className="px-4 py-3 text-sm">
                      {row.status !== 'PAID' ? (
                        <button
                          type="button"
                          onClick={() => setSingleConfirm(row)}
                          className="rounded-lg bg-green-600 px-3 py-1.5 font-medium text-white hover:bg-green-700"
                        >
                          Mark paid
                        </button>
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
            {hasProjectedRows && (
              <p className="mt-2 max-w-2xl text-sm text-gray-500">
                <span className="font-medium">(projected)</span> is the next billing month when your system has not
                returned that row yet. Mark paid records it using your gym API (member + billing month).
              </p>
            )}
          </div>
          {user?.role === 'GYM_ADMIN' && selectableUnpaid.length > 0 && (
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
                Select all unpaid
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

        {monthlyInstallments.length === 0 && !loading && !error ? (
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
    </Layout>
  );
}

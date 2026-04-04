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

type InstallmentStatus = 'PENDING' | 'OVERDUE' | 'PAID' | string;

interface MonthlyInstallment {
  id: string;
  memberId?: string;
  month: string;
  amount: number;
  status: InstallmentStatus;
  dueDate: string;
  paidDate: string | null;
  member?: { id: string; name: string; phone: string | null; email: string | null };
}

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
  const [monthlyInstallments, setMonthlyInstallments] = useState<MonthlyInstallment[]>([]);
  const [groupedFromApi, setGroupedFromApi] = useState<{
    paid: MonthlyInstallment[];
    pending: MonthlyInstallment[];
    overdue: MonthlyInstallment[];
  }>({ paid: [], pending: [], overdue: [] });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [singleConfirm, setSingleConfirm] = useState<MonthlyInstallment | null>(null);

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
      const g = data.monthlyGrouped || {};

      const normalized = timeline.map(normalizeInstallment).sort(sortByDueDate);
      setMonthlyInstallments(normalized);

      setGroupedFromApi({
        paid: ((g.paid || []) as Record<string, unknown>[]).map(normalizeInstallment).sort(sortByDueDate),
        pending: ((g.pending || []) as Record<string, unknown>[]).map(normalizeInstallment).sort(sortByDueDate),
        overdue: ((g.overdue || []) as Record<string, unknown>[]).map(normalizeInstallment).sort(sortByDueDate),
      });

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
          }
        } catch {
          /* optional */
        }
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

  const grouped = useMemo(() => {
    const sum =
      groupedFromApi.paid.length +
      groupedFromApi.pending.length +
      groupedFromApi.overdue.length;
    if (sum > 0) return groupedFromApi;
    const paid: MonthlyInstallment[] = [];
    const pending: MonthlyInstallment[] = [];
    const overdue: MonthlyInstallment[] = [];
    for (const i of monthlyInstallments) {
      if (i.status === 'PAID') paid.push(i);
      else if (i.status === 'OVERDUE') overdue.push(i);
      else if (i.status === 'PENDING') pending.push(i);
      else pending.push(i);
    }
    return {
      paid: paid.sort(sortByDueDate),
      pending: pending.sort(sortByDueDate),
      overdue: overdue.sort(sortByDueDate),
    };
  }, [groupedFromApi, monthlyInstallments]);

  const selectableUnpaid = useMemo(() => {
    return [...grouped.pending, ...grouped.overdue].filter(
      (i) => i.status === 'PENDING' || i.status === 'OVERDUE'
    );
  }, [grouped.pending, grouped.overdue]);

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
      const paymentIds = ids.map((id) => Number(id)).filter((n) => !Number.isNaN(n));
      const response = await api.post('/api/payments/bulk-mark-paid', { paymentIds });
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || 'Bulk mark paid failed');
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
      const response = await api.patch(`/api/payments/${inst.id}/mark-paid`);
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || 'Mark paid failed');
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'OVERDUE':
        return 'bg-red-100 text-red-800';
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

  const renderSection = (title: string, items: MonthlyInstallment[], showSelect: boolean) => {
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
              const canSelect = showSelect && (row.status === 'PENDING' || row.status === 'OVERDUE');
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
                  <td className="px-4 py-3 text-sm text-gray-900">{row.month}</td>
                  <td className="px-4 py-3 text-sm">Rs. {row.amount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(row.dueDate)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusColor(row.status)}`}>
                      {row.status}
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
                        <button
                          type="button"
                          onClick={() => handlePrintReceipt(row)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-gray-800 hover:bg-gray-50"
                        >
                          Receipt
                        </button>
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

      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/payments" className="text-sm font-medium text-primary hover:underline">
              ← Back to payments
            </Link>
            <h1 className="mt-2 text-3xl font-bold text-dark-gray">{memberName || 'Member payments'}</h1>
            <p className="mt-1 text-sm text-gray-500">Monthly installments (fresh overdue status from server)</p>
          </div>
          {user?.role === 'GYM_ADMIN' && selectableUnpaid.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
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
            <p className="text-sm text-gray-500">
              Installments are listed by due date within each group. Full timeline: {monthlyInstallments.length} month(s).
            </p>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-dark-gray">Overdue</h2>
              {renderSection('overdue', grouped.overdue, true)}
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-dark-gray">Pending</h2>
              {renderSection('pending', grouped.pending, true)}
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-dark-gray">Paid</h2>
              {renderSection('paid', grouped.paid, false)}
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

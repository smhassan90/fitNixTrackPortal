'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@/components/Alert';
import Loading from '@/components/Loading';
import PosPermissionGate from '@/components/pos/PosPermissionGate';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import { fetchPosReportSummary, posErrorMessage } from '@/lib/pos/posApi';
import { POS_PERMISSION_KEYS } from '@/lib/pos/permissions';
import { formatMoney } from '@/lib/pos/utils';
import type { PosReportSummaryRow } from '@/lib/pos/types';

export default function PosReportsPage() {
  const { can } = useAuth();
  const canView = can(POS_PERMISSION_KEYS.revenueRead);
  const { alert, showAlert, closeAlert } = useAlert();

  const [groupBy, setGroupBy] = useState<'day' | 'category' | 'subcategory' | 'product'>('day');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<PosReportSummaryRow[]>([]);
  const [totals, setTotals] = useState<PosReportSummaryRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchPosReportSummary({
        groupBy,
        from: from || undefined,
        to: to || undefined,
      });
      setRows(result.rows);
      setTotals(result.totals);
    } catch (e) {
      showAlert('error', 'Could not load report', posErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [groupBy, from, to, showAlert]);

  useEffect(() => {
    if (canView) void load();
    else setLoading(false);
  }, [canView, load]);

  return (
    <>
      <Alert isOpen={alert.isOpen} onClose={closeAlert} type={alert.type} title={alert.title} message={alert.message} />
      <h1 className="mb-4 text-2xl font-bold text-dark-gray">POS Reports</h1>
      <PosPermissionGate allowed={canView} message="You need View POS revenue permission to see these reports.">
        <div className="mb-4 flex flex-wrap gap-2">
          <select className="rounded border px-3 py-2 text-sm" value={groupBy} onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}>
            <option value="day">By day</option>
            <option value="category">By category</option>
            <option value="subcategory">By subcategory</option>
            <option value="product">By product</option>
          </select>
          <input type="date" className="rounded border px-3 py-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className="rounded border px-3 py-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          <button type="button" onClick={load} className="rounded-lg bg-primary px-4 py-2 text-sm text-white">Apply</button>
        </div>

        {totals && (
          <div className="mb-6 grid gap-4 sm:grid-cols-4">
            {[
              { label: 'Sales', value: String(totals.saleCount) },
              { label: 'Subtotal', value: formatMoney(totals.subtotal) },
              { label: 'Discounts', value: formatMoney(totals.discountTotal) },
              { label: 'Total revenue', value: formatMoney(totals.total) },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border bg-white p-4 shadow-sm">
                <p className="text-xs uppercase text-gray-500">{card.label}</p>
                <p className="mt-1 text-xl font-bold text-dark-gray">{card.value}</p>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <Loading message="Loading report…" />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">Label</th>
                  <th className="px-4 py-3 text-right">Sales</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3 text-right">Discounts</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No data for this range.</td></tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.key}>
                      <td className="px-4 py-3">{r.label}</td>
                      <td className="px-4 py-3 text-right">{r.saleCount}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(r.subtotal)}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(r.discountTotal)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatMoney(r.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </PosPermissionGate>
    </>
  );
}

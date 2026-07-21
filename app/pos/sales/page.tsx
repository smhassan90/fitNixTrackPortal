'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@/components/Alert';
import Loading from '@/components/Loading';
import PosPermissionGate from '@/components/pos/PosPermissionGate';
import PosReceiptModal from '@/components/pos/PosReceiptModal';
import PosVoidSaleModal from '@/components/pos/PosVoidSaleModal';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import { fetchPosSales, posErrorMessage, voidPosSale } from '@/lib/pos/posApi';
import { POS_PERMISSION_KEYS } from '@/lib/pos/permissions';
import { formatMoney } from '@/lib/pos/utils';
import type { PosSale } from '@/lib/pos/types';
import { formatDate } from '@/lib/dateUtils';

export default function PosSalesPage() {
  const { can } = useAuth();
  const canView = can(POS_PERMISSION_KEYS.catalogRead);
  const canSell = can(POS_PERMISSION_KEYS.sell);
  const { alert, showAlert, closeAlert } = useAlert();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<PosSale | null>(null);
  const [voidTarget, setVoidTarget] = useState<PosSale | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchPosSales({
        from: from || undefined,
        to: to || undefined,
        status: status || undefined,
        page,
        limit: 20,
      });
      setSales(result.sales);
      setPagination(result.pagination);
    } catch (e) {
      showAlert('error', 'Could not load sales', posErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [from, to, status, page, showAlert]);

  useEffect(() => {
    if (canView) void load();
    else setLoading(false);
  }, [canView, load]);

  return (
    <>
      <Alert isOpen={alert.isOpen} onClose={closeAlert} type={alert.type} title={alert.title} message={alert.message} />
      <PosReceiptModal sale={receipt} onClose={() => setReceipt(null)} />
      <PosVoidSaleModal
        open={Boolean(voidTarget)}
        receiptNo={voidTarget?.receiptNo ?? ''}
        onClose={() => setVoidTarget(null)}
        onConfirm={async (reason) => {
          if (!voidTarget) return;
          try {
            await voidPosSale(voidTarget.id, reason);
            showAlert('success', 'Voided', 'Sale voided and stock restored.');
            await load();
          } catch (e) {
            showAlert('error', 'Void failed', posErrorMessage(e));
            throw e;
          }
        }}
      />

      <h1 className="mb-4 text-2xl font-bold text-dark-gray">Sales History</h1>
      <PosPermissionGate allowed={canView}>
        <div className="mb-4 flex flex-wrap gap-2">
          <input type="date" className="rounded border px-3 py-2 text-sm" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <input type="date" className="rounded border px-3 py-2 text-sm" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          <select className="rounded border px-3 py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="VOIDED">Voided</option>
          </select>
        </div>

        {loading ? (
          <Loading message="Loading sales…" />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">Receipt</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Member</th>
                  <th className="px-4 py-3 text-left">Total</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sales.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No sales found.</td></tr>
                ) : (
                  sales.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{s.receiptNo}</td>
                      <td className="px-4 py-3">{formatDate(s.createdAt)}</td>
                      <td className="px-4 py-3">{s.memberName || '—'}</td>
                      <td className="px-4 py-3">{formatMoney(s.total)}</td>
                      <td className="px-4 py-3">{s.status}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" className="mr-3 text-primary" onClick={() => setReceipt(s)}>Receipt</button>
                        {canSell && s.status === 'COMPLETED' && (
                          <button type="button" className="text-red-600" onClick={() => setVoidTarget(s)}>Void</button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {pagination.totalPages > 1 && (
              <div className="flex justify-between border-t px-4 py-3 text-sm">
                <span>Page {pagination.page} of {pagination.totalPages}</span>
                <div className="flex gap-2">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40">Prev</button>
                  <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border px-2 py-1 disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </div>
        )}
      </PosPermissionGate>
    </>
  );
}

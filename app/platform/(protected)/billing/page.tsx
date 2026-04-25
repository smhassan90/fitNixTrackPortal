'use client';

import { useEffect, useState } from 'react';
import { listPlatformBillingDues } from '@/lib/platform/platformApi';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import Loading from '@/components/Loading';
import Alert from '@/components/Alert';
import { useAlert } from '@/hooks/useAlert';
import { billingCollectedAmount, billingHistorySummary, describeBillingRow } from '@/lib/platform/presentation';

export default function PlatformBillingPage() {
  const { alert, showAlert, closeAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<unknown[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [overdue, setOverdue] = useState('');
  const [dueInDays, setDueInDays] = useState('');
  const [planId, setPlanId] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params: Record<string, string | number | undefined> = {
          page: pagination.page,
          limit: Math.min(pagination.limit, 100),
        };
        if (overdue === 'true' || overdue === 'false') params.overdue = overdue;
        if (dueInDays.trim()) params.dueInDays = Number(dueInDays);
        if (planId.trim()) {
          const n = Number(planId);
          if (!Number.isNaN(n)) params.planId = n;
        }
        if (status.trim()) params.status = status.trim();
        const data = await listPlatformBillingDues(params);
        if (cancelled) return;
        const list = (data.items as unknown[]) || (data.dues as unknown[]) || [];
        setRows(Array.isArray(list) ? list : []);
        const pg = data.pagination;
        if (pg) {
          setPagination((p) => ({
            ...p,
            total: pg.total,
            totalPages: pg.totalPages,
            page: pg.page ?? p.page,
          }));
        }
      } catch (e) {
        if (!cancelled) showAlert('error', 'Billing', mapPlatformErrorToUserMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pagination.page, pagination.limit, overdue, dueInDays, planId, status, showAlert]);

  return (
    <>
      <Alert
        isOpen={alert.isOpen}
        onClose={closeAlert}
        type={alert.type}
        title={alert.title}
        message={alert.message}
      />
      <h1 className="text-2xl font-bold">Billing</h1>
      <p className="text-sm text-dark-gray-light mt-1">
        Review who is behind on payments and which subscriptions need a follow-up.
      </p>

      <div className="mt-6 flex flex-wrap gap-3 rounded-xl bg-white p-4 border border-light-gray-dark shadow">
        <select
          value={overdue}
          onChange={(e) => {
            setOverdue(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">Any balance state</option>
          <option value="true">Overdue only</option>
          <option value="false">Not overdue</option>
        </select>
        <input
          placeholder="Due within (days)"
          value={dueInDays}
          onChange={(e) => {
            setDueInDays(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className="rounded-lg border px-3 py-2 text-sm w-28"
        />
        <input
          placeholder="Billing plan ID"
          value={planId}
          onChange={(e) => {
            setPlanId(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className="rounded-lg border px-3 py-2 text-sm w-28"
        />
        <input
          placeholder="Subscription status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className="rounded-lg border px-3 py-2 text-sm flex-1 min-w-[12rem]"
        />
        <select
          value={pagination.limit}
          onChange={(e) =>
            setPagination((p) => ({ ...p, limit: Number(e.target.value), page: 1 }))
          }
          className="rounded-lg border px-3 py-2 text-sm"
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} per page
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <Loading message="Loading dues…" size="md" />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border bg-white shadow">
          <table className="min-w-full text-sm">
            <thead className="bg-light-gray text-left text-dark-gray-light">
              <tr>
                <th className="px-3 py-2">Gym</th>
                <th className="px-3 py-2">Subscription</th>
                <th className="px-3 py-2">Amount collected</th>
                <th className="px-3 py-2">Billing history</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-dark-gray-light">
                    No billing rows match these filters.
                  </td>
                </tr>
              )}
              {rows.map((row, i) => {
                const { title, subtitle } = describeBillingRow(row);
                const collected = billingCollectedAmount(row);
                const history = billingHistorySummary(row);
                return (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 font-medium text-dark-gray align-top">{title}</td>
                    <td className="px-3 py-2 text-dark-gray-light align-top">{subtitle}</td>
                    <td className="px-3 py-2 text-dark-gray-light align-top">{collected}</td>
                    <td className="px-3 py-2 text-dark-gray-light align-top">{history}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex justify-between text-sm">
        <button
          type="button"
          disabled={pagination.page <= 1}
          onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
          className="rounded border px-3 py-1 disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-dark-gray-light">
          Page {pagination.page} / {pagination.totalPages}
        </span>
        <button
          type="button"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
          className="rounded border px-3 py-1 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </>
  );
}

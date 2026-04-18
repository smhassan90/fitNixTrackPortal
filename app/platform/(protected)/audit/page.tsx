'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { listPlatformAuditLogs } from '@/lib/platform/platformApi';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import { useIsPlatformSuperAdmin } from '@/contexts/PlatformAuthContext';
import Loading from '@/components/Loading';
import Alert from '@/components/Alert';
import { useAlert } from '@/hooks/useAlert';

function AuditContent() {
  const isSuper = useIsPlatformSuperAdmin();
  const searchParams = useSearchParams();
  const targetGymId = searchParams.get('targetGymId') || '';
  const { alert, showAlert, closeAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<unknown[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [actionType, setActionType] = useState('');

  useEffect(() => {
    if (!isSuper) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params: Record<string, string | number | undefined> = {
          page: pagination.page,
          limit: Math.min(pagination.limit, 100),
        };
        if (targetGymId) params.targetGymId = targetGymId;
        if (actionType.trim()) params.actionType = actionType.trim();
        const data = await listPlatformAuditLogs(params);
        if (cancelled) return;
        const list = (data.logs as unknown[]) || (data.items as unknown[]) || [];
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
        if (!cancelled) showAlert('error', 'Audit', mapPlatformErrorToUserMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSuper, pagination.page, pagination.limit, targetGymId, actionType, showAlert]);

  if (!isSuper) {
    return (
      <div className="rounded-xl border border-warning bg-warning-light/20 p-6 text-sm">
        <h1 className="text-lg font-semibold text-dark-gray">Audit log</h1>
        <p className="mt-2 text-dark-gray-light">
          This area is restricted to SUPER_ADMIN. Support accounts receive 403 from GET
          /api/platform/audit-logs.
        </p>
      </div>
    );
  }

  return (
    <>
      <Alert
        isOpen={alert.isOpen}
        onClose={closeAlert}
        type={alert.type}
        title={alert.title}
        message={alert.message}
      />
      <h1 className="text-2xl font-bold">Audit log</h1>
      <p className="text-sm text-dark-gray-light mt-1">GET /api/platform/audit-logs</p>
      {targetGymId && (
        <p className="mt-2 text-sm">
          Filter: <span className="font-mono">targetGymId={targetGymId}</span>
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3 rounded-xl bg-white p-4 border shadow">
        <input
          placeholder="actionType"
          value={actionType}
          onChange={(e) => {
            setActionType(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className="rounded-lg border px-3 py-2 text-sm"
        />
        <select
          value={pagination.limit}
          onChange={(e) =>
            setPagination((p) => ({ ...p, limit: Number(e.target.value), page: 1 }))
          }
          className="rounded-lg border px-3 py-2 text-sm"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}/page
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <Loading message="Loading audit…" size="md" />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border bg-white shadow">
          <table className="min-w-full text-sm">
            <thead className="bg-light-gray text-left text-dark-gray-light">
              <tr>
                <th className="px-3 py-2">Entry</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-center text-dark-gray-light">No rows</td>
                </tr>
              )}
              {rows.map((row, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs whitespace-pre-wrap break-all">
                    {typeof row === 'object' ? JSON.stringify(row, null, 2) : String(row)}
                  </td>
                </tr>
              ))}
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

export default function PlatformAuditPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loading message="Loading audit…" size="md" />
        </div>
      }
    >
      <AuditContent />
    </Suspense>
  );
}

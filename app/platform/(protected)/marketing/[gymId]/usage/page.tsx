'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  getMarketingAiUsage,
  getMarketingAuditLog,
  getMarketingOverview,
} from '@/lib/platform/marketingApi';
import type {
  MarketingAiUsageSummary,
  MarketingAuditLogRow,
} from '@/lib/platform/marketingTypes';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import MarketingSubNav from '@/components/platform/marketing/MarketingSubNav';
import Loading from '@/components/Loading';
import Alert from '@/components/Alert';
import { useAlert } from '@/hooks/useAlert';

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function MarketingUsagePage() {
  const params = useParams();
  const gymId = String(params.gymId);
  const { alert, showAlert, closeAlert } = useAlert();
  const [gymName, setGymName] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<MarketingAiUsageSummary | null>(null);
  const [logs, setLogs] = useState<MarketingAuditLogRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = monthRange();
      const [u, audit, overview] = await Promise.all([
        getMarketingAiUsage({ gymId, from: start, to: end }),
        getMarketingAuditLog({ gymId, page: 1, limit: 40 }),
        getMarketingOverview(gymId).catch(() => null),
      ]);
      setUsage(u);
      setLogs(audit.logs || []);
      if (overview?.gym?.name) setGymName(overview.gym.name);
    } catch (e) {
      showAlert('error', 'Usage / audit', mapPlatformErrorToUserMessage(e));
    } finally {
      setLoading(false);
    }
  }, [gymId, showAlert]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <Loading message="Loading usage & audit…" fullScreen size="md" />;
  }

  return (
    <div>
      <MarketingSubNav gymId={gymId} gymName={gymName} />
      <Alert
        isOpen={alert.isOpen}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={closeAlert}
      />

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-dark-gray">AI usage & audit</h2>
        <p className="mt-1 text-sm text-dark-gray-light">
          Super Admin only. Tracks generations and important marketing actions for this gym.
        </p>
      </div>

      <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-light-gray-dark bg-white p-4 shadow-sm">
          <p className="text-xs text-dark-gray-light">Text requests</p>
          <p className="mt-1 text-2xl font-semibold">{usage?.textRequests ?? 0}</p>
        </div>
        <div className="rounded-xl border border-light-gray-dark bg-white p-4 shadow-sm">
          <p className="text-xs text-dark-gray-light">Images</p>
          <p className="mt-1 text-2xl font-semibold">{usage?.imageGenerations ?? 0}</p>
        </div>
        <div className="rounded-xl border border-light-gray-dark bg-white p-4 shadow-sm">
          <p className="text-xs text-dark-gray-light">Blogs</p>
          <p className="mt-1 text-2xl font-semibold">{usage?.blogGenerations ?? 0}</p>
        </div>
        <div className="rounded-xl border border-light-gray-dark bg-white p-4 shadow-sm">
          <p className="text-xs text-dark-gray-light">Estimated AI cost</p>
          <p className="mt-1 text-2xl font-semibold">
            ${Number(usage?.estimatedCostUsd ?? 0).toFixed(2)}
          </p>
        </div>
      </section>

      {usage?.byOperation && Object.keys(usage.byOperation).length > 0 && (
        <section className="mb-8 rounded-xl border border-light-gray-dark bg-white p-4 shadow">
          <h3 className="font-semibold">By operation (this month)</h3>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {Object.entries(usage.byOperation).map(([op, count]) => (
              <li key={op} className="flex justify-between gap-4 rounded-lg bg-[#f8f8f8] px-3 py-2">
                <span className="text-dark-gray-light">{op}</span>
                <span className="font-medium">{count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-light-gray-dark bg-white shadow">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">Marketing audit log</h3>
          <p className="text-xs text-dark-gray-light">
            Who generated, approved, published — including social account used and failures.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-[#f8f8f8] text-xs uppercase text-dark-gray-light">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-dark-gray-light">
                    No marketing audit entries yet.
                  </td>
                </tr>
              ) : (
                logs.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-4 py-3 text-dark-gray-light">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {row.actorName || `User #${row.actorUserId}`}
                      <span className="block text-xs text-dark-gray-light">{row.actorRole}</span>
                    </td>
                    <td className="px-4 py-3 font-medium">{row.actionType}</td>
                    <td className="px-4 py-3 text-xs text-dark-gray-light">
                      {row.metadata ? JSON.stringify(row.metadata) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

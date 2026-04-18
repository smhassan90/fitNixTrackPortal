'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format, subDays } from 'date-fns';
import {
  getPlatformReportsSummary,
  getPlatformTopGymsByMembers,
  listPlatformBillingDues,
} from '@/lib/platform/platformApi';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import Loading from '@/components/Loading';
import { useIsPlatformSuperAdmin } from '@/contexts/PlatformAuthContext';

export default function PlatformOverviewPage() {
  const isSuper = useIsPlatformSuperAdmin();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [top, setTop] = useState<unknown[]>([]);
  const [duesPreview, setDuesPreview] = useState<unknown[]>([]);

  useEffect(() => {
    const end = format(new Date(), 'yyyy-MM-dd');
    const start = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [s, t, d] = await Promise.all([
          getPlatformReportsSummary(start, end),
          getPlatformTopGymsByMembers(10),
          listPlatformBillingDues({ overdue: 'true', page: 1, limit: 5 }),
        ]);
        if (cancelled) return;
        setSummary(s as Record<string, unknown>);
        setTop((t.gyms as unknown[]) || []);
        const rows = (d.items as unknown[]) || (d.dues as unknown[]) || [];
        setDuesPreview(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (!cancelled) setErr(mapPlatformErrorToUserMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <Loading message="Loading dashboard…" fullScreen size="md" />;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-dark-gray">Platform overview</h1>
      <p className="mt-1 text-sm text-dark-gray-light">
        Same API host as the gym app; platform JWT is stored in sessionStorage and is not valid on
        gym routes.
      </p>

      {err && (
        <div className="mt-4 rounded-lg border border-error bg-error-light/10 px-4 py-3 text-sm text-error-dark">
          {err}
        </div>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-xl bg-white p-6 shadow border border-light-gray-dark">
          <h2 className="text-lg font-semibold">Reports (last 30 days)</h2>
          <p className="text-xs text-dark-gray-light mt-1">
            GET /api/platform/reports/summary — aggregates from backend
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-dark-gray-light">totalCollectedInRange</dt>
              <dd className="font-mono">
                {summary?.totalCollectedInRange != null
                  ? String(summary.totalCollectedInRange)
                  : '—'}
              </dd>
            </div>
            {summary &&
              Object.entries(summary)
                .filter(([k]) => k !== 'totalCollectedInRange')
                .slice(0, 6)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-dark-gray-light truncate">{k}</dt>
                    <dd className="font-mono text-right truncate max-w-[50%]">{String(v)}</dd>
                  </div>
                ))}
          </dl>
          <Link href="/platform/reports" className="mt-4 inline-block text-sm text-primary font-medium">
            Full reports →
          </Link>
        </section>

        <section className="rounded-xl bg-white p-6 shadow border border-light-gray-dark">
          <h2 className="text-lg font-semibold">Top gyms by members</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {top.length === 0 && <li className="text-dark-gray-light">No data</li>}
            {top.slice(0, 5).map((row, i) => (
              <li key={i} className="flex justify-between border-b border-light-gray pb-2">
                <span className="truncate pr-2">
                  {(row as { name?: string })?.name ?? JSON.stringify(row).slice(0, 40)}
                </span>
                <span className="font-mono shrink-0">
                  {(row as { membersCount?: number })?.membersCount ?? '—'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl bg-white p-6 shadow border border-light-gray-dark md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Overdue sample</h2>
            <Link href="/platform/billing" className="text-sm text-primary font-medium">
              Billing dues →
            </Link>
          </div>
          <p className="text-xs text-dark-gray-light mt-1">
            GET /api/platform/billing/dues?overdue=true (first 5 rows)
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-dark-gray-light border-b">
                  <th className="pb-2 pr-4">Row</th>
                </tr>
              </thead>
              <tbody>
                {duesPreview.length === 0 && (
                  <tr>
                    <td className="py-3 text-dark-gray-light">No rows</td>
                  </tr>
                )}
                {duesPreview.map((row, i) => (
                  <tr key={i} className="border-b border-light-gray">
                    <td className="py-2 font-mono text-xs max-w-prose truncate">
                      {typeof row === 'object' ? JSON.stringify(row) : String(row)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {isSuper && (
        <p className="mt-8 text-xs text-dark-gray-light max-w-2xl">
          <strong>Super admin:</strong> you can create gyms, suspend tenants, edit subscriptions, and
          view audit logs. Support role is read-only for mutating controls.
        </p>
      )}
    </div>
  );
}

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
import {
  describeBillingRow,
  describeTopGymRow,
  formatMetricValue,
  friendlyMetricLabel,
} from '@/lib/platform/presentation';

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
      <h1 className="text-2xl font-bold text-dark-gray">Home</h1>
      <p className="mt-1 text-sm text-dark-gray-light">
        A quick snapshot of how tenants are doing. Figures below cover roughly the last 30 days unless noted.
      </p>

      {err && (
        <div className="mt-4 rounded-lg border border-error bg-error-light/10 px-4 py-3 text-sm text-error-dark">
          {err}
        </div>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-xl bg-white p-6 shadow border border-light-gray-dark">
          <h2 className="text-lg font-semibold">Money & activity</h2>
          <p className="text-xs text-dark-gray-light mt-1">High-level totals for the last 30 days.</p>
          <dl className="mt-4 space-y-2 text-sm">
            {summary && Object.keys(summary).length > 0 ? (
              Object.entries(summary)
                .slice(0, 8)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-dark-gray-light truncate">{friendlyMetricLabel(k)}</dt>
                    <dd className="text-right font-medium text-dark-gray truncate max-w-[55%]">
                      {formatMetricValue(v)}
                    </dd>
                  </div>
                ))
            ) : (
              <p className="text-dark-gray-light text-sm">No summary data for this period yet.</p>
            )}
          </dl>
          <Link href="/platform/reports" className="mt-4 inline-block text-sm text-primary font-medium">
            Open reports →
          </Link>
        </section>

        <section className="rounded-xl bg-white p-6 shadow border border-light-gray-dark">
          <h2 className="text-lg font-semibold">Largest gyms</h2>
          <p className="text-xs text-dark-gray-light mt-1">By active member count.</p>
          <ul className="mt-4 space-y-2 text-sm">
            {top.length === 0 && <li className="text-dark-gray-light">No data yet.</li>}
            {top.slice(0, 5).map((row, i) => {
              const { name, membersCount, gymId } = describeTopGymRow(row);
              return (
                <li key={gymId ?? i} className="flex justify-between border-b border-light-gray pb-2">
                  <span className="truncate pr-2 font-medium text-dark-gray">{name}</span>
                  <span className="shrink-0 text-dark-gray-light tabular-nums">
                    {membersCount != null ? membersCount.toLocaleString() : '—'} members
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-xl bg-white p-6 shadow border border-light-gray-dark md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Accounts needing attention</h2>
            <Link href="/platform/billing" className="text-sm text-primary font-medium">
              Open billing →
            </Link>
          </div>
          <p className="text-xs text-dark-gray-light mt-1">A short list of overdue balances (up to five).</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-dark-gray-light border-b">
                  <th className="pb-2 pr-4">Gym</th>
                  <th className="pb-2">Summary</th>
                </tr>
              </thead>
              <tbody>
                {duesPreview.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-3 text-dark-gray-light">
                      Nothing overdue right now, or billing data is still loading.
                    </td>
                  </tr>
                )}
                {duesPreview.map((row, i) => {
                  const { title, subtitle } = describeBillingRow(row);
                  return (
                    <tr key={i} className="border-b border-light-gray">
                      <td className="py-2 pr-4 font-medium text-dark-gray align-top">{title}</td>
                      <td className="py-2 text-dark-gray-light align-top">{subtitle}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {isSuper && (
        <p className="mt-8 text-xs text-dark-gray-light max-w-2xl">
          <strong>Super admin:</strong> you can add gyms, pause or resume tenants, change billing, review audit history,
          and manage who has platform access. Support teammates mostly have read-only access.
        </p>
      )}
    </div>
  );
}

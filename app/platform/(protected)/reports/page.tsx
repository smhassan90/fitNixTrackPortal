'use client';

import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { getPlatformReportsSummary, getPlatformTopGymsByMembers } from '@/lib/platform/platformApi';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import Loading from '@/components/Loading';
import Alert from '@/components/Alert';
import { useAlert } from '@/hooks/useAlert';
import { formatMetricValue, friendlyMetricLabel } from '@/lib/platform/presentation';

export default function PlatformReportsPage() {
  const { alert, showAlert, closeAlert } = useAlert();
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [topLimit, setTopLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [top, setTop] = useState<unknown[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([
        getPlatformReportsSummary(startDate, endDate),
        getPlatformTopGymsByMembers(topLimit),
      ]);
      setSummary(s as Record<string, unknown>);
      setTop((t.gyms as unknown[]) || []);
    } catch (e) {
      showAlert('error', 'Reports', mapPlatformErrorToUserMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Alert
        isOpen={alert.isOpen}
        onClose={closeAlert}
        type={alert.type}
        title={alert.title}
        message={alert.message}
      />
      <h1 className="text-2xl font-bold">Reports</h1>
      <p className="text-sm text-dark-gray-light mt-1">
        Explore collections and member growth across gyms for any date range you pick.
      </p>

      <div className="mt-6 flex flex-wrap gap-3 items-end rounded-xl bg-white p-4 border shadow">
        <div>
          <label className="text-xs text-dark-gray-light block">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-dark-gray-light block">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded border px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-dark-gray-light block">How many top gyms</label>
          <input
            type="number"
            min={1}
            max={50}
            value={topLimit}
            onChange={(e) => setTopLimit(Number(e.target.value) || 10)}
            className="w-20 rounded border px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <Loading message="Loading reports…" size="md" />
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section className="rounded-xl bg-white p-4 border shadow">
            <h2 className="font-semibold">Summary</h2>
            <p className="text-xs text-dark-gray-light mt-1">Key numbers for the range you selected.</p>
            {summary ? (
              <dl className="mt-4 space-y-2 text-sm">
                {Object.entries(summary).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 border-b border-light-gray/80 pb-2">
                    <dt className="text-dark-gray-light">{friendlyMetricLabel(k)}</dt>
                    <dd className="font-medium text-dark-gray text-right">{formatMetricValue(v)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-4 text-sm text-dark-gray-light">Choose dates and tap Refresh.</p>
            )}
          </section>
          <section className="rounded-xl bg-white p-4 border shadow">
            <h2 className="font-semibold">Busiest gyms</h2>
            <p className="text-xs text-dark-gray-light mt-1">Ranked by members on file.</p>
            {top.length ? (
              <ul className="mt-4 space-y-2 text-sm">
                {top.map((row, i) => (
                  <li key={i} className="flex justify-between border-b border-light-gray pb-2">
                    <span className="font-medium text-dark-gray truncate pr-2">
                      {(row as { name?: string })?.name ?? 'Gym'}
                    </span>
                    <span className="shrink-0 text-dark-gray-light tabular-nums">
                      {(row as { membersCount?: number })?.membersCount ?? '—'} members
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-dark-gray-light">Choose dates and tap Refresh.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}

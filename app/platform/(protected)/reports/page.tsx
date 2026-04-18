'use client';

import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { getPlatformReportsSummary, getPlatformTopGymsByMembers } from '@/lib/platform/platformApi';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import Loading from '@/components/Loading';
import Alert from '@/components/Alert';
import { useAlert } from '@/hooks/useAlert';

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
        GET /api/platform/reports/summary and /api/platform/reports/gyms/top-by-members
      </p>

      <div className="mt-6 flex flex-wrap gap-3 items-end rounded-xl bg-white p-4 border shadow">
        <div>
          <label className="text-xs text-dark-gray-light block">startDate</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-dark-gray-light block">endDate</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded border px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-dark-gray-light block">Top gyms limit</label>
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
          {loading ? 'Loading…' : 'Load'}
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
            <pre className="mt-3 text-xs overflow-auto max-h-[28rem] bg-light-gray p-3 rounded-lg">
              {summary ? JSON.stringify(summary, null, 2) : 'Click Load'}
            </pre>
          </section>
          <section className="rounded-xl bg-white p-4 border shadow">
            <h2 className="font-semibold">Top gyms by members</h2>
            <pre className="mt-3 text-xs overflow-auto max-h-[28rem] bg-light-gray p-3 rounded-lg">
              {top.length ? JSON.stringify(top, null, 2) : 'Click Load'}
            </pre>
          </section>
        </div>
      )}
    </>
  );
}

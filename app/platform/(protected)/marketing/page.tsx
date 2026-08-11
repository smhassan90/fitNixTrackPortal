'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listMarketingGyms } from '@/lib/platform/marketingApi';
import type { MarketingGymSummary } from '@/lib/platform/marketingTypes';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import Loading from '@/components/Loading';
import Alert from '@/components/Alert';
import { useAlert } from '@/hooks/useAlert';

/**
 * Marketing gym selector — Super Admin picks a gym before any marketing work.
 * All marketing data is gym-scoped.
 */
export default function MarketingGymSelectPage() {
  const { alert, showAlert, closeAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [gyms, setGyms] = useState<MarketingGymSummary[]>([]);
  const [backendReady, setBackendReady] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params: Record<string, string | number | undefined> = {
          page: 1,
          limit: 100,
        };
        if (appliedSearch.trim()) params.search = appliedSearch.trim();
        const data = await listMarketingGyms(params);
        if (cancelled) return;
        setGyms(data.gyms || []);
        setBackendReady(true);
      } catch (e) {
        if (cancelled) return;
        const msg = mapPlatformErrorToUserMessage(e);
        const notFound =
          msg.toLowerCase().includes('not found') ||
          (typeof e === 'object' &&
            e !== null &&
            'status' in e &&
            (e as { status: number }).status === 404);
        setBackendReady(!notFound);
        setGyms([]);
        showAlert(
          'error',
          'Marketing gyms',
          notFound
            ? 'Marketing APIs are not available yet. Deploy the Phase 1 backend routes, then refresh.'
            : msg
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appliedSearch, showAlert]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-gray">Marketing</h1>
          <p className="mt-1 text-sm text-dark-gray-light">
            Select a gym to manage its marketing profile, content, and publishing. Gym owners never
            see this area.
          </p>
        </div>
        <Link
          href="/platform/marketing/settings"
          className="rounded-lg border border-light-gray-dark bg-white px-4 py-2 text-sm text-dark-gray hover:bg-[#f8f8f8]"
        >
          Marketing settings
        </Link>
      </div>

      <Alert
        isOpen={alert.isOpen}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={closeAlert}
      />

      <form
        className="mt-6 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setAppliedSearch(search);
        }}
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search gyms by name or city…"
          className="min-w-[220px] flex-1 rounded-lg border border-light-gray-dark bg-white px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button type="submit" className="btn-primary rounded-lg px-4 py-2 text-sm">
          Search
        </button>
      </form>

      {loading ? (
        <div className="mt-10">
          <Loading message="Loading gyms…" size="md" />
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-light-gray-dark bg-white shadow">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-light-gray-dark bg-[#f8f8f8] text-xs uppercase text-dark-gray-light">
              <tr>
                <th className="px-4 py-3 font-medium">Gym</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Profile</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {gyms.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-dark-gray-light">
                    {backendReady
                      ? 'No gyms match your search.'
                      : 'Waiting for marketing backend endpoints.'}
                  </td>
                </tr>
              ) : (
                gyms.map((g) => {
                  const loc = [g.city, g.country].filter(Boolean).join(', ') || '—';
                  return (
                    <tr key={g.id} className="border-b border-light-gray last:border-0">
                      <td className="px-4 py-3 font-medium text-dark-gray">{g.name}</td>
                      <td className="px-4 py-3 text-dark-gray-light">{loc}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            g.tenantStatus === 'SUSPENDED'
                              ? 'bg-error-light/20 text-error-dark'
                              : 'bg-primary/15 text-ink'
                          }`}
                        >
                          {g.tenantStatus || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-dark-gray-light">
                        {g.hasMarketingProfile ? 'Ready' : 'Not set up'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/platform/marketing/${g.id}`}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

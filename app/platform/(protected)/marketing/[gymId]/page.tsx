'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getMarketingOverview } from '@/lib/platform/marketingApi';
import type { MarketingOverviewData } from '@/lib/platform/marketingTypes';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import MarketingSubNav from '@/components/platform/marketing/MarketingSubNav';
import Loading from '@/components/Loading';
import Alert from '@/components/Alert';
import { useAlert } from '@/hooks/useAlert';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-light-gray-dark bg-white p-4 shadow-sm">
      <p className="text-xs text-dark-gray-light">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-dark-gray">{value}</p>
    </div>
  );
}

export default function MarketingOverviewPage() {
  const params = useParams();
  const gymId = String(params.gymId);
  const { alert, showAlert, closeAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MarketingOverviewData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const overview = await getMarketingOverview(gymId);
        if (!cancelled) setData(overview);
      } catch (e) {
        if (!cancelled) {
          setData(null);
          showAlert('error', 'Overview', mapPlatformErrorToUserMessage(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gymId, showAlert]);

  if (loading) {
    return <Loading message="Loading marketing overview…" fullScreen size="md" />;
  }

  const gymName = data?.gym?.name;
  const month = data?.contentThisMonth;
  const ai = data?.aiActivity;

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

      {!data ? (
        <div className="rounded-xl border border-light-gray-dark bg-white p-6 text-sm text-dark-gray-light shadow">
          Could not load overview for this gym. Confirm the Phase 1 marketing backend is deployed.
        </div>
      ) : (
        <>
          {!data.profileComplete && (
            <div className="mb-6 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-dark-gray">
              Marketing profile is incomplete.{' '}
              <Link
                href={`/platform/marketing/${gymId}/profile`}
                className="font-medium text-ink underline underline-offset-2"
              >
                Complete the profile
              </Link>{' '}
              so AI recommendations use real gym facts only.
            </div>
          )}

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-dark-gray">Content this month</h2>
            <p className="mt-1 text-xs text-dark-gray-light">
              Counts fill in as later phases add publishing and blogs.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Social posts" value={month?.socialPosts ?? 0} />
              <StatCard label="Blogs" value={month?.blogs ?? 0} />
              <StatCard label="Google Business posts" value={month?.googleBusinessPosts ?? 0} />
              <StatCard label="Scheduled" value={month?.scheduledPosts ?? 0} />
              <StatCard label="Published" value={month?.publishedPosts ?? 0} />
              <StatCard label="Failed" value={month?.failedPosts ?? 0} />
            </div>
          </section>

          <section className="mb-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-light-gray-dark bg-white p-6 shadow">
              <h2 className="text-lg font-semibold text-dark-gray">AI activity</h2>
              <p className="mt-1 text-xs text-dark-gray-light">Tracked per gym (Super Admin only).</p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-dark-gray-light">Text generations</dt>
                  <dd className="font-medium">{ai?.textGenerations ?? 0}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-dark-gray-light">Image generations</dt>
                  <dd className="font-medium">{ai?.imageGenerations ?? 0}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-dark-gray-light">Estimated cost</dt>
                  <dd className="font-medium">
                    {ai?.estimatedCostUsd != null
                      ? `$${Number(ai.estimatedCostUsd).toFixed(2)}`
                      : '—'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-light-gray-dark bg-white p-6 shadow">
              <h2 className="text-lg font-semibold text-dark-gray">Needs attention</h2>
              {(data.attention?.length ?? 0) === 0 &&
              (data.recommendations?.length ?? 0) === 0 ? (
                <p className="mt-4 text-sm text-dark-gray-light">
                  Nothing urgent. Start by reviewing the marketing profile.
                </p>
              ) : (
                <ul className="mt-4 space-y-2 text-sm">
                  {(data.attention || []).map((item, i) => (
                    <li
                      key={`a-${i}`}
                      className="rounded-lg border border-light-gray-dark bg-[#f8f8f8] px-3 py-2"
                    >
                      {item.href ? (
                        <Link href={item.href} className="hover:underline">
                          {item.message}
                        </Link>
                      ) : (
                        item.message
                      )}
                    </li>
                  ))}
                  {(data.recommendations || []).map((rec, i) => (
                    <li
                      key={`r-${i}`}
                      className="rounded-lg border border-light-gray-dark px-3 py-2 text-dark-gray-light"
                    >
                      {rec}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-dark-gray-light">
                <span>Opportunities awaiting review: {data.opportunitiesAwaitingReview ?? 0}</span>
                <span>·</span>
                <span>Posts awaiting approval: {data.postsAwaitingApproval ?? 0}</span>
                <span>·</span>
                <span>Connected accounts: {data.connectedAccountsCount ?? 0}</span>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/platform/marketing/${gymId}/profile`}
              className="btn-primary rounded-lg px-4 py-2 text-sm"
            >
              Edit marketing profile
            </Link>
            <Link
              href={`/platform/gyms/${gymId}`}
              className="rounded-lg border border-light-gray-dark bg-white px-4 py-2 text-sm text-dark-gray hover:bg-[#f8f8f8]"
            >
              Open gym record
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

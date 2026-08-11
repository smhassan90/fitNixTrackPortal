'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  generateMarketingOpportunities,
  getMarketingOverview,
  listMarketingOpportunities,
} from '@/lib/platform/marketingApi';
import type { MarketingOpportunity } from '@/lib/platform/marketingTypes';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import MarketingSubNav from '@/components/platform/marketing/MarketingSubNav';
import { OpportunityStatusBadge } from '@/components/platform/marketing/MarketingStatusBadges';
import Loading from '@/components/Loading';
import Alert from '@/components/Alert';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { useAlert } from '@/hooks/useAlert';

type StatusFilter = '' | 'DRAFT' | 'AWAITING_REVIEW' | 'APPROVED' | 'REJECTED' | 'CONVERTED';

export default function MarketingOpportunitiesPage() {
  const params = useParams();
  const gymId = String(params.gymId);
  const { alert, showAlert, closeAlert } = useAlert();
  const [gymName, setGymName] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [status, setStatus] = useState<StatusFilter>('AWAITING_REVIEW');
  const [rows, setRows] = useState<MarketingOpportunity[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, overview] = await Promise.all([
        listMarketingOpportunities(gymId, {
          page: 1,
          limit: 50,
          ...(status ? { status } : {}),
        }),
        getMarketingOverview(gymId).catch(() => null),
      ]);
      setRows(list.opportunities || []);
      if (overview?.gym?.name) setGymName(overview.gym.name);
    } catch (e) {
      setRows([]);
      showAlert('error', 'Opportunities', mapPlatformErrorToUserMessage(e));
    } finally {
      setLoading(false);
    }
  }, [gymId, status, showAlert]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleGenerate() {
    setConfirmGenerate(false);
    setGenerating(true);
    try {
      const result = await generateMarketingOpportunities(gymId, { count: 5 });
      showAlert(
        'success',
        'Generated',
        `Created ${result.generatedCount ?? result.opportunities?.length ?? 0} opportunities for review. Nothing was published.`
      );
      setStatus('AWAITING_REVIEW');
      await load();
    } catch (e) {
      showAlert('error', 'Generate failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setGenerating(false);
    }
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

      <ConfirmationDialog
        isOpen={confirmGenerate}
        title="Generate content opportunities?"
        message="AI will suggest topics from this gym’s marketing profile. You must review and approve before any content is created or published."
        confirmText={generating ? 'Generating…' : 'Generate'}
        cancelText="Cancel"
        type="info"
        onConfirm={() => void handleGenerate()}
        onClose={() => setConfirmGenerate(false)}
      />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-dark-gray">Content opportunities</h2>
          <p className="mt-1 text-sm text-dark-gray-light">
            AI recommends useful topics. You decide what to pursue. No auto-publish.
          </p>
        </div>
        <button
          type="button"
          disabled={generating}
          onClick={() => setConfirmGenerate(true)}
          className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-60"
        >
          {generating ? 'Generating…' : 'Ask AI for opportunities'}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ['', 'All'],
            ['AWAITING_REVIEW', 'Awaiting review'],
            ['APPROVED', 'Approved'],
            ['CONVERTED', 'Converted'],
            ['REJECTED', 'Rejected'],
            ['DRAFT', 'Draft'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value || 'all'}
            type="button"
            onClick={() => setStatus(value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              status === value
                ? 'bg-primary text-white'
                : 'border border-light-gray-dark bg-white text-dark-gray-light hover:bg-[#f8f8f8]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading || generating ? (
        <Loading message={generating ? 'AI is drafting opportunities…' : 'Loading…'} size="md" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-light-gray-dark bg-white shadow">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-light-gray-dark bg-[#f8f8f8] text-xs uppercase text-dark-gray-light">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Platform</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-dark-gray-light">
                    No opportunities yet. Generate ideas from the marketing profile.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-light-gray last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-dark-gray">{row.title}</p>
                      {row.reason && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-dark-gray-light">
                          {row.reason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-dark-gray-light">{row.contentType || '—'}</td>
                    <td className="px-4 py-3 text-dark-gray-light">
                      {row.suggestedPlatform || '—'}
                    </td>
                    <td className="px-4 py-3 text-dark-gray-light">{row.priority ?? 0}</td>
                    <td className="px-4 py-3">
                      <OpportunityStatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/platform/marketing/${gymId}/opportunities/${row.id}`}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

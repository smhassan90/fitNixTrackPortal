'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  approveMarketingOpportunity,
  generateSocialPostFromOpportunity,
  getMarketingOpportunity,
  getMarketingOverview,
  rejectMarketingOpportunity,
} from '@/lib/platform/marketingApi';
import type { MarketingOpportunity } from '@/lib/platform/marketingTypes';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import MarketingSubNav from '@/components/platform/marketing/MarketingSubNav';
import { OpportunityStatusBadge } from '@/components/platform/marketing/MarketingStatusBadges';
import Loading from '@/components/Loading';
import Alert from '@/components/Alert';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { useAlert } from '@/hooks/useAlert';

export default function MarketingOpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const gymId = String(params.gymId);
  const opportunityId = String(params.opportunityId);
  const { alert, showAlert, closeAlert } = useAlert();
  const [gymName, setGymName] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [row, setRow] = useState<MarketingOpportunity | null>(null);
  const [confirm, setConfirm] = useState<'approve' | 'reject' | 'generate' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [opp, overview] = await Promise.all([
        getMarketingOpportunity(opportunityId),
        getMarketingOverview(gymId).catch(() => null),
      ]);
      if (String(opp.gymId) !== gymId) {
        showAlert('error', 'Opportunity', 'This opportunity does not belong to the selected gym.');
        setRow(null);
        return;
      }
      setRow(opp);
      if (overview?.gym?.name) setGymName(overview.gym.name);
    } catch (e) {
      setRow(null);
      showAlert('error', 'Opportunity', mapPlatformErrorToUserMessage(e));
    } finally {
      setLoading(false);
    }
  }, [gymId, opportunityId, showAlert]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(action: 'approve' | 'reject' | 'generate') {
    setConfirm(null);
    setBusy(true);
    try {
      if (action === 'approve') {
        const updated = await approveMarketingOpportunity(opportunityId);
        setRow(updated);
        showAlert('success', 'Approved', 'Opportunity approved. You can generate a social post.');
      } else if (action === 'reject') {
        const updated = await rejectMarketingOpportunity(opportunityId);
        setRow(updated);
        showAlert('success', 'Rejected', 'Opportunity marked as rejected.');
      } else {
        const content = await generateSocialPostFromOpportunity(opportunityId);
        showAlert(
          'success',
          'Draft created',
          'Social post draft is ready for your review. Nothing was published.'
        );
        router.push(`/platform/marketing/${gymId}/content/${content.id}`);
        return;
      }
    } catch (e) {
      showAlert('error', 'Action failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <Loading message="Loading opportunity…" fullScreen size="md" />;
  }

  const canApprove = row && (row.status === 'AWAITING_REVIEW' || row.status === 'DRAFT');
  const canReject = row && row.status !== 'REJECTED' && row.status !== 'CONVERTED';
  // Backend requires APPROVED first (then sets CONVERTED after draft creation).
  const canGenerate = row && row.status === 'APPROVED';

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
        isOpen={confirm === 'approve'}
        title="Approve this opportunity?"
        message="You can then generate a social post draft. Publishing still requires a later explicit action."
        confirmText="Approve"
        type="info"
        onConfirm={() => void runAction('approve')}
        onClose={() => setConfirm(null)}
      />
      <ConfirmationDialog
        isOpen={confirm === 'reject'}
        title="Reject this opportunity?"
        message="Rejected ideas stay in history so you do not regenerate the same topic blindly."
        confirmText="Reject"
        type="danger"
        onConfirm={() => void runAction('reject')}
        onClose={() => setConfirm(null)}
      />
      <ConfirmationDialog
        isOpen={confirm === 'generate'}
        title="Generate social post?"
        message="AI will draft caption, CTA, hashtags, and an image concept. You must edit and approve before any publish step."
        confirmText={busy ? 'Generating…' : 'Generate draft'}
        type="info"
        onConfirm={() => void runAction('generate')}
        onClose={() => setConfirm(null)}
      />

      <div className="mb-4">
        <Link
          href={`/platform/marketing/${gymId}/opportunities`}
          className="text-sm text-dark-gray-light underline-offset-2 hover:underline"
        >
          ← Back to opportunities
        </Link>
      </div>

      {!row ? (
        <div className="rounded-xl border border-light-gray-dark bg-white p-6 text-sm text-dark-gray-light shadow">
          Opportunity not found.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-light-gray-dark bg-white p-6 shadow">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-dark-gray">{row.title}</h2>
                <div className="mt-2">
                  <OpportunityStatusBadge status={row.status} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canApprove && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirm('approve')}
                    className="btn-primary rounded-lg px-3 py-2 text-sm disabled:opacity-60"
                  >
                    Approve
                  </button>
                )}
                {canReject && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirm('reject')}
                    className="rounded-lg border border-error/40 px-3 py-2 text-sm text-error-dark hover:bg-error-light/10 disabled:opacity-60"
                  >
                    Reject
                  </button>
                )}
                {canGenerate && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirm('generate')}
                    className="rounded-lg border border-light-gray-dark bg-white px-3 py-2 text-sm hover:bg-[#f8f8f8] disabled:opacity-60"
                  >
                    Generate social post
                  </button>
                )}
              </div>
            </div>

            <dl className="mt-6 grid gap-4 text-sm md:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase text-dark-gray-light">Why this</dt>
                <dd className="mt-1 whitespace-pre-wrap text-dark-gray">{row.reason || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-dark-gray-light">
                  Target audience
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-dark-gray">{row.audience || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-dark-gray-light">Content type</dt>
                <dd className="mt-1 text-dark-gray">{row.contentType || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-dark-gray-light">
                  Suggested platform
                </dt>
                <dd className="mt-1 text-dark-gray">{row.suggestedPlatform || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-dark-gray-light">SEO intent</dt>
                <dd className="mt-1 whitespace-pre-wrap text-dark-gray">{row.seoIntent || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-dark-gray-light">Keywords</dt>
                <dd className="mt-1 whitespace-pre-wrap text-dark-gray">{row.keywords || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-dark-gray-light">Priority</dt>
                <dd className="mt-1 text-dark-gray">{row.priority ?? 0}</dd>
              </div>
            </dl>
          </div>

          <p className="text-xs text-dark-gray-light">
            Workflow: review opportunity → approve → generate social post → edit → approve content.
            Image generation and publishing come in later phases.
          </p>
        </div>
      )}
    </div>
  );
}

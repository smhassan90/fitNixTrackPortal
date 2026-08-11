'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  getMarketingContent,
  getMarketingOverview,
  listMarketingPublishAttempts,
  listMarketingSocialAccounts,
  publishMarketingContent,
  retryMarketingPublishAttempt,
  scheduleMarketingContent,
  updateMarketingContent,
} from '@/lib/platform/marketingApi';
import type {
  MarketingContent,
  MarketingPlatformVariants,
  MarketingPublishAttempt,
  MarketingSocialAccount,
} from '@/lib/platform/marketingTypes';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import MarketingSubNav from '@/components/platform/marketing/MarketingSubNav';
import { ContentStatusBadge } from '@/components/platform/marketing/MarketingStatusBadges';
import Loading from '@/components/Loading';
import Alert from '@/components/Alert';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { useAlert } from '@/hooks/useAlert';

const inputClass =
  'w-full rounded-lg border border-light-gray-dark bg-white px-3 py-2 text-sm outline-none focus:border-primary';
const areaClass = `${inputClass} min-h-[100px] resize-y`;

const PLATFORM_KEYS = [
  { key: 'facebook', label: 'Facebook', variantKey: 'facebook' as const },
  { key: 'instagram', label: 'Instagram', variantKey: 'instagram' as const },
  { key: 'linkedin', label: 'LinkedIn', variantKey: 'linkedin' as const },
  { key: 'google_business', label: 'Google Business', variantKey: 'googleBusiness' as const },
];

export default function MarketingFinalReviewPage() {
  const params = useParams();
  const gymId = String(params.gymId);
  const contentId = String(params.contentId);
  const { alert, showAlert, closeAlert } = useAlert();
  const [gymName, setGymName] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [content, setContent] = useState<MarketingContent | null>(null);
  const [accounts, setAccounts] = useState<MarketingSocialAccount[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [attempts, setAttempts] = useState<MarketingPublishAttempt[]>([]);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [cta, setCta] = useState('');
  const [variants, setVariants] = useState<MarketingPlatformVariants>({});
  const [scheduleAt, setScheduleAt] = useState('');
  const [confirm, setConfirm] = useState<'publish' | 'schedule' | null>(null);

  const approvedImage = useMemo(() => {
    const versions = content?.imageVersions || [];
    return (
      versions.find((v) => v.status === 'APPROVED') ||
      versions.find((v) => v.id === content?.approvedImageVersionId) ||
      null
    );
  }, [content]);

  const connected = useMemo(
    () => accounts.filter((a) => a.status === 'CONNECTED'),
    [accounts]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, social, overview, attemptData] = await Promise.all([
        getMarketingContent(contentId),
        listMarketingSocialAccounts(gymId),
        getMarketingOverview(gymId).catch(() => null),
        listMarketingPublishAttempts(contentId).catch(() => ({ attempts: [] })),
      ]);
      if (String(c.gymId) !== gymId) {
        showAlert('error', 'Content', 'Content does not belong to this gym.');
        setContent(null);
        return;
      }
      setContent(c);
      setCaption(c.caption || '');
      setHashtags(c.hashtags || '');
      setCta(c.cta || '');
      setVariants(c.platformVariants || {});
      const list = social.accounts || [];
      setAccounts(list);
      const connectedIds = list.filter((a) => a.status === 'CONNECTED').map((a) => a.id);
      // Default: ALL connected accounts selected
      setSelectedIds(connectedIds);
      setAttempts(attemptData.attempts || []);
      if (overview?.gym?.name) setGymName(overview.gym.name);
    } catch (e) {
      showAlert('error', 'Final review', mapPlatformErrorToUserMessage(e));
    } finally {
      setLoading(false);
    }
  }, [contentId, gymId, showAlert]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleAccount(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function persistCopy() {
    const updated = await updateMarketingContent(contentId, {
      caption: caption || null,
      hashtags: hashtags || null,
      cta: cta || null,
      platformVariants: variants,
    });
    setContent(updated);
    return updated;
  }

  async function runPublish() {
    setConfirm(null);
    if (selectedIds.length === 0) {
      showAlert('warning', 'Select accounts', 'Select at least one connected account.');
      return;
    }
    if (!approvedImage?.imageUrl) {
      showAlert('warning', 'Image required', 'Approve an image before publishing.');
      return;
    }
    setBusy(true);
    try {
      await persistCopy();
      const result = await publishMarketingContent(contentId, {
        socialAccountIds: selectedIds,
      });
      setContent(result.content);
      setAttempts(result.attempts || []);
      if (result.allSucceeded) {
        showAlert('success', 'Published', 'Published to all selected platforms.');
      } else {
        showAlert(
          'warning',
          'Partial publish',
          'Some platforms failed. Retry failed ones below — successful posts were kept.'
        );
      }
    } catch (e) {
      showAlert('error', 'Publish failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function runSchedule() {
    setConfirm(null);
    if (selectedIds.length === 0) {
      showAlert('warning', 'Select accounts', 'Select at least one connected account.');
      return;
    }
    if (!scheduleAt) {
      showAlert('warning', 'Schedule time', 'Pick a date and time to schedule.');
      return;
    }
    if (!approvedImage?.imageUrl) {
      showAlert('warning', 'Image required', 'Approve an image before scheduling.');
      return;
    }
    setBusy(true);
    try {
      await persistCopy();
      const result = await scheduleMarketingContent(contentId, {
        socialAccountIds: selectedIds,
        scheduledAt: new Date(scheduleAt).toISOString(),
      });
      setContent(result.content);
      showAlert('success', 'Scheduled', `Scheduled for ${new Date(result.scheduledAt).toLocaleString()}.`);
    } catch (e) {
      showAlert('error', 'Schedule failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function retryAttempt(id: number) {
    setBusy(true);
    try {
      const updated = await retryMarketingPublishAttempt(id);
      setAttempts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      showAlert(
        updated.status === 'SUCCEEDED' ? 'success' : 'error',
        'Retry',
        updated.status === 'SUCCEEDED'
          ? `${updated.platform} published.`
          : updated.errorMessage || 'Retry failed.'
      );
    } catch (e) {
      showAlert('error', 'Retry failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <Loading message="Loading final review…" fullScreen size="md" />;
  }

  const canAct =
    content &&
    (content.status === 'APPROVED' ||
      content.status === 'FAILED' ||
      content.status === 'SCHEDULED');

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
        isOpen={confirm === 'publish'}
        title="Publish now?"
        message="This will post to each selected connected account. AI does not publish — only this explicit action does."
        confirmText={busy ? 'Publishing…' : 'PUBLISH NOW'}
        type="warning"
        onConfirm={() => void runPublish()}
        onClose={() => setConfirm(null)}
      />
      <ConfirmationDialog
        isOpen={confirm === 'schedule'}
        title="Schedule post?"
        message="Queues this post for the selected time. You can reschedule or cancel from the calendar."
        confirmText={busy ? 'Scheduling…' : 'SCHEDULE'}
        type="info"
        onConfirm={() => void runSchedule()}
        onClose={() => setConfirm(null)}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/platform/marketing/${gymId}/content/${contentId}`}
          className="text-sm text-dark-gray-light underline-offset-2 hover:underline"
        >
          ← Back to editor
        </Link>
        {content && <ContentStatusBadge status={content.status} />}
      </div>

      {!content ? (
        <div className="rounded-xl border border-light-gray-dark bg-white p-6 text-sm shadow">
          Content not found.
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-dark-gray">Final post review</h2>
            <p className="mt-1 text-sm text-dark-gray-light">
              Review image, copy, platform variants, then publish or schedule. All connected accounts
              are selected by default — uncheck any you want to skip.
            </p>
          </div>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-light-gray-dark bg-white p-4 shadow">
              <h3 className="text-sm font-semibold">Image</h3>
              <div className="mt-2 flex min-h-[220px] items-center justify-center rounded-lg bg-[#f8f8f8]">
                {approvedImage?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={approvedImage.imageUrl}
                    alt="Approved creative"
                    className="max-h-[320px] object-contain"
                  />
                ) : (
                  <p className="p-4 text-center text-sm text-error-dark">
                    No approved image. Approve one in the editor first.
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-3 rounded-xl border border-light-gray-dark bg-white p-4 shadow">
              <label className="block text-sm">
                <span className="font-medium">Caption</span>
                <textarea
                  className={`${areaClass} mt-1`}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Hashtags</span>
                <textarea
                  className={`${areaClass} mt-1 min-h-[64px]`}
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">CTA</span>
                <input
                  className={`${inputClass} mt-1`}
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-light-gray-dark bg-white p-4 shadow">
            <h3 className="text-sm font-semibold">Platform-specific variants</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {PLATFORM_KEYS.map((p) => (
                <label key={p.key} className="block text-sm">
                  <span className="font-medium">{p.label}</span>
                  <textarea
                    className={`${areaClass} mt-1`}
                    value={variants[p.variantKey] || ''}
                    onChange={(e) =>
                      setVariants((v) => ({ ...v, [p.variantKey]: e.target.value }))
                    }
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-light-gray-dark bg-white p-4 shadow">
            <h3 className="text-sm font-semibold">Publish to</h3>
            <p className="mt-1 text-xs text-dark-gray-light">
              Connected accounts are selected by default. Uncheck to skip.
            </p>
            {connected.length === 0 ? (
              <p className="mt-3 text-sm text-warning-dark">
                No connected accounts.{' '}
                <Link href={`/platform/marketing/${gymId}/social`} className="underline">
                  Connect social accounts
                </Link>
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {connected.map((a) => (
                  <li key={a.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(a.id)}
                        onChange={() => toggleAccount(a.id)}
                      />
                      <span className="font-medium capitalize">
                        {String(a.platform).replace(/_/g, ' ')}
                      </span>
                      <span className="text-dark-gray-light">
                        — {a.accountName || `Account #${a.id}`}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-wrap items-end gap-3 rounded-xl border border-light-gray-dark bg-white p-4 shadow">
            <label className="block text-sm">
              <span className="font-medium">Schedule at (optional)</span>
              <input
                type="datetime-local"
                className={`${inputClass} mt-1`}
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={busy || !canAct}
              onClick={() => setConfirm('publish')}
              className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-60"
            >
              PUBLISH NOW
            </button>
            <button
              type="button"
              disabled={busy || !canAct || !scheduleAt}
              onClick={() => setConfirm('schedule')}
              className="rounded-lg border border-light-gray-dark bg-white px-4 py-2 text-sm disabled:opacity-60"
            >
              SCHEDULE
            </button>
            {!canAct && (
              <p className="w-full text-xs text-dark-gray-light">
                Content must be approved (and have an approved image) before publish/schedule.
              </p>
            )}
          </section>

          {attempts.length > 0 && (
            <section className="rounded-xl border border-light-gray-dark bg-white p-4 shadow">
              <h3 className="text-sm font-semibold">Per-platform results</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {attempts.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-light-gray-dark px-3 py-2"
                  >
                    <div>
                      <span className="font-medium capitalize">
                        {a.platform?.replace(/_/g, ' ') || 'Platform'}
                      </span>
                      <span className="ml-2 text-dark-gray-light">
                        {a.status === 'SUCCEEDED' && '✓ Published'}
                        {a.status === 'FAILED' && `✗ Failed${a.errorMessage ? `: ${a.errorMessage}` : ''}`}
                        {a.status === 'PENDING' && '… Pending'}
                      </span>
                    </div>
                    {a.status === 'FAILED' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void retryAttempt(a.id)}
                        className="rounded-lg border border-light-gray-dark px-3 py-1 text-xs disabled:opacity-60"
                      >
                        Retry
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  approveMarketingContent,
  getMarketingContent,
  getMarketingOverview,
  rejectMarketingContent,
  submitMarketingContentForApproval,
  updateMarketingContent,
} from '@/lib/platform/marketingApi';
import type {
  MarketingContent,
  MarketingPlatformVariants,
} from '@/lib/platform/marketingTypes';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import MarketingSubNav from '@/components/platform/marketing/MarketingSubNav';
import MarketingImageWorkflow from '@/components/platform/marketing/MarketingImageWorkflow';
import { ContentStatusBadge } from '@/components/platform/marketing/MarketingStatusBadges';
import Loading from '@/components/Loading';
import Alert from '@/components/Alert';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { useAlert } from '@/hooks/useAlert';

type Draft = {
  title: string;
  topic: string;
  headline: string;
  caption: string;
  captionShort: string;
  cta: string;
  hashtags: string;
  imageConcept: string;
  imagePrompt: string;
  suggestedPlatforms: string;
  facebook: string;
  instagram: string;
  linkedin: string;
  googleBusiness: string;
};

const emptyDraft: Draft = {
  title: '',
  topic: '',
  headline: '',
  caption: '',
  captionShort: '',
  cta: '',
  hashtags: '',
  imageConcept: '',
  imagePrompt: '',
  suggestedPlatforms: '',
  facebook: '',
  instagram: '',
  linkedin: '',
  googleBusiness: '',
};

function platformsToString(value: MarketingContent['suggestedPlatforms']): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'string') return value;
  return '';
}

function fromContent(c: MarketingContent): Draft {
  const v = c.platformVariants || {};
  return {
    title: c.title || '',
    topic: c.topic || '',
    headline: c.headline || '',
    caption: c.caption || '',
    captionShort: c.captionShort || '',
    cta: c.cta || '',
    hashtags: c.hashtags || '',
    imageConcept: c.imageConcept || '',
    imagePrompt: c.imagePrompt || '',
    suggestedPlatforms: platformsToString(c.suggestedPlatforms),
    facebook: v.facebook || '',
    instagram: v.instagram || '',
    linkedin: v.linkedin || '',
    googleBusiness: v.googleBusiness || '',
  };
}

const inputClass =
  'w-full rounded-lg border border-light-gray-dark bg-white px-3 py-2 text-sm outline-none focus:border-primary';
const areaClass = `${inputClass} min-h-[100px] resize-y`;

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-dark-gray">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-dark-gray-light">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export default function MarketingContentEditorPage() {
  const params = useParams();
  const gymId = String(params.gymId);
  const contentId = String(params.contentId);
  const { alert, showAlert, closeAlert } = useAlert();
  const [gymName, setGymName] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [content, setContent] = useState<MarketingContent | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [confirm, setConfirm] = useState<'submit' | 'approve' | 'reject' | null>(null);

  const setField = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, overview] = await Promise.all([
        getMarketingContent(contentId),
        getMarketingOverview(gymId).catch(() => null),
      ]);
      if (String(c.gymId) !== gymId) {
        showAlert('error', 'Content', 'This content does not belong to the selected gym.');
        setContent(null);
        return;
      }
      setContent(c);
      setDraft(fromContent(c));
      if (overview?.gym?.name) setGymName(overview.gym.name);
    } catch (e) {
      setContent(null);
      showAlert('error', 'Content', mapPlatformErrorToUserMessage(e));
    } finally {
      setLoading(false);
    }
  }, [contentId, gymId, showAlert]);

  useEffect(() => {
    void load();
  }, [load]);

  function buildUpdatePayload() {
    const variants: MarketingPlatformVariants = {
      facebook: draft.facebook || null,
      instagram: draft.instagram || null,
      linkedin: draft.linkedin || null,
      googleBusiness: draft.googleBusiness || null,
    };
    return {
      title: draft.title,
      topic: draft.topic || null,
      headline: draft.headline || null,
      caption: draft.caption || null,
      captionShort: draft.captionShort || null,
      cta: draft.cta || null,
      hashtags: draft.hashtags || null,
      imageConcept: draft.imageConcept || null,
      imagePrompt: draft.imagePrompt || null,
      suggestedPlatforms: draft.suggestedPlatforms
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      platformVariants: variants,
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateMarketingContent(contentId, buildUpdatePayload());
      setContent(updated);
      setDraft(fromContent(updated));
      showAlert('success', 'Saved', 'Draft updated. Nothing was published.');
    } catch (err) {
      showAlert('error', 'Save failed', mapPlatformErrorToUserMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function runWorkflow(action: 'submit' | 'approve' | 'reject') {
    setConfirm(null);
    setBusy(true);
    try {
      // Persist edits before status change so approval uses latest copy.
      const saved = await updateMarketingContent(contentId, buildUpdatePayload());
      let next = saved;
      if (action === 'submit') {
        next = await submitMarketingContentForApproval(contentId);
        showAlert('success', 'Submitted', 'Marked awaiting approval.');
      } else if (action === 'approve') {
        next = await approveMarketingContent(contentId);
        showAlert(
          'success',
          'Approved',
          'Content approved. Image generation and publishing are later phases — still not published.'
        );
      } else {
        next = await rejectMarketingContent(contentId);
        showAlert('success', 'Rejected', 'Content marked rejected.');
      }
      setContent(next);
      setDraft(fromContent(next));
    } catch (e) {
      showAlert('error', 'Workflow failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <Loading message="Loading content…" fullScreen size="md" />;
  }

  const editable =
    content &&
    (content.status === 'DRAFT' ||
      content.status === 'AWAITING_APPROVAL' ||
      content.status === 'REJECTED');
  /** Image workflow stays available after copy approval (still pre-publish). */
  const imageEditable =
    !!content &&
    content.status !== 'PUBLISHED' &&
    content.status !== 'SCHEDULED' &&
    content.status !== 'FAILED';
  const canSubmit = content && content.status === 'DRAFT';
  const canApprove =
    content && (content.status === 'AWAITING_APPROVAL' || content.status === 'DRAFT');
  const canReject =
    content && content.status !== 'REJECTED' && content.status !== 'PUBLISHED';

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
        isOpen={confirm === 'submit'}
        title="Submit for approval?"
        message="Move this draft to awaiting approval. It will not publish."
        confirmText="Submit"
        type="info"
        onConfirm={() => void runWorkflow('submit')}
        onClose={() => setConfirm(null)}
      />
      <ConfirmationDialog
        isOpen={confirm === 'approve'}
        title="Approve this social post?"
        message="Approves the copy only. Image generation and publishing require later explicit steps."
        confirmText="Approve"
        type="info"
        onConfirm={() => void runWorkflow('approve')}
        onClose={() => setConfirm(null)}
      />
      <ConfirmationDialog
        isOpen={confirm === 'reject'}
        title="Reject this content?"
        message="You can still edit and re-submit later."
        confirmText="Reject"
        type="danger"
        onConfirm={() => void runWorkflow('reject')}
        onClose={() => setConfirm(null)}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          href={
            content?.opportunityId
              ? `/platform/marketing/${gymId}/opportunities/${content.opportunityId}`
              : `/platform/marketing/${gymId}/opportunities`
          }
          className="text-sm text-dark-gray-light underline-offset-2 hover:underline"
        >
          ← Back
        </Link>
        {content && <ContentStatusBadge status={content.status} />}
      </div>

      {!content ? (
        <div className="rounded-xl border border-light-gray-dark bg-white p-6 text-sm text-dark-gray-light shadow">
          Content not found.
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-dark-gray">Social post editor</h2>
              <p className="mt-1 text-sm text-dark-gray-light">
                Review and edit AI output. Human approval required. Never auto-publishes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving || busy || !editable}
                className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save draft'}
              </button>
              {canSubmit && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirm('submit')}
                  className="rounded-lg border border-light-gray-dark bg-white px-4 py-2 text-sm disabled:opacity-60"
                >
                  Submit for approval
                </button>
              )}
              {canApprove && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirm('approve')}
                  className="rounded-lg border border-primary bg-primary/15 px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
                >
                  Approve
                </button>
              )}
              {canReject && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirm('reject')}
                  className="rounded-lg border border-error/40 px-4 py-2 text-sm text-error-dark disabled:opacity-60"
                >
                  Reject
                </button>
              )}
              <Link
                href={`/platform/marketing/${gymId}/content/${contentId}/publish`}
                className="rounded-lg border border-light-gray-dark bg-white px-4 py-2 text-sm hover:bg-[#f8f8f8]"
              >
                Final review / Publish
              </Link>
            </div>
          </div>

          <section className="rounded-xl border border-light-gray-dark bg-white p-6 shadow">
            <h3 className="font-semibold text-dark-gray">Core copy</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Title">
                <input
                  className={inputClass}
                  value={draft.title}
                  disabled={!editable}
                  onChange={(e) => setField('title', e.target.value)}
                  required
                />
              </Field>
              <Field label="Topic">
                <input
                  className={inputClass}
                  value={draft.topic}
                  disabled={!editable}
                  onChange={(e) => setField('topic', e.target.value)}
                />
              </Field>
              <Field label="Headline / hook" hint="Opening line that grabs attention.">
                <input
                  className={inputClass}
                  value={draft.headline}
                  disabled={!editable}
                  onChange={(e) => setField('headline', e.target.value)}
                />
              </Field>
              <Field label="CTA">
                <input
                  className={inputClass}
                  value={draft.cta}
                  disabled={!editable}
                  onChange={(e) => setField('cta', e.target.value)}
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Caption">
                  <textarea
                    className={areaClass}
                    value={draft.caption}
                    disabled={!editable}
                    onChange={(e) => setField('caption', e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Short caption">
                <textarea
                  className={areaClass}
                  value={draft.captionShort}
                  disabled={!editable}
                  onChange={(e) => setField('captionShort', e.target.value)}
                />
              </Field>
              <Field label="Hashtags" hint="Space or comma separated.">
                <textarea
                  className={areaClass}
                  value={draft.hashtags}
                  disabled={!editable}
                  onChange={(e) => setField('hashtags', e.target.value)}
                />
              </Field>
              <Field label="Suggested platforms" hint="Comma-separated, e.g. facebook, instagram">
                <input
                  className={inputClass}
                  value={draft.suggestedPlatforms}
                  disabled={!editable}
                  onChange={(e) => setField('suggestedPlatforms', e.target.value)}
                />
              </Field>
            </div>
          </section>

          <MarketingImageWorkflow
            contentId={contentId}
            gymId={gymId}
            content={content}
            imageConcept={draft.imageConcept}
            imagePrompt={draft.imagePrompt}
            editable={imageEditable}
            onConceptChange={(value) => setField('imageConcept', value)}
            onPromptChange={(value) => setField('imagePrompt', value)}
            onContentUpdated={(updated) => {
              setContent(updated);
              setDraft((d) => ({
                ...d,
                imageConcept: updated.imageConcept ?? d.imageConcept,
                imagePrompt: updated.imagePrompt ?? d.imagePrompt,
              }));
            }}
            onAlert={showAlert}
          />

          <section className="rounded-xl border border-light-gray-dark bg-white p-6 shadow">
            <h3 className="font-semibold text-dark-gray">Platform-specific variants</h3>
            <p className="mt-1 text-xs text-dark-gray-light">
              Adapt tone per channel. Publishing selection comes in Phase 5.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Facebook">
                <textarea
                  className={areaClass}
                  value={draft.facebook}
                  disabled={!editable}
                  onChange={(e) => setField('facebook', e.target.value)}
                />
              </Field>
              <Field label="Instagram">
                <textarea
                  className={areaClass}
                  value={draft.instagram}
                  disabled={!editable}
                  onChange={(e) => setField('instagram', e.target.value)}
                />
              </Field>
              <Field label="LinkedIn">
                <textarea
                  className={areaClass}
                  value={draft.linkedin}
                  disabled={!editable}
                  onChange={(e) => setField('linkedin', e.target.value)}
                />
              </Field>
              <Field label="Google Business">
                <textarea
                  className={areaClass}
                  value={draft.googleBusiness}
                  disabled={!editable}
                  onChange={(e) => setField('googleBusiness', e.target.value)}
                />
              </Field>
            </div>
          </section>
        </form>
      )}
    </div>
  );
}

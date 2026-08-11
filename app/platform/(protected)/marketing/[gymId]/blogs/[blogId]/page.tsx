'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  approveMarketingBlog,
  getMarketingBlog,
  getMarketingOverview,
  publishMarketingBlogToWebsite,
  updateMarketingBlog,
} from '@/lib/platform/marketingApi';
import type { MarketingBlog } from '@/lib/platform/marketingTypes';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import MarketingSubNav from '@/components/platform/marketing/MarketingSubNav';
import Loading from '@/components/Loading';
import Alert from '@/components/Alert';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { useAlert } from '@/hooks/useAlert';

const inputClass =
  'w-full rounded-lg border border-light-gray-dark bg-white px-3 py-2 text-sm outline-none focus:border-primary';
const areaClass = `${inputClass} min-h-[96px] resize-y`;

type Draft = {
  title: string;
  slug: string;
  excerpt: string;
  introduction: string;
  body: string;
  conclusion: string;
  cta: string;
  seoTitle: string;
  metaDescription: string;
  targetKeyword: string;
  secondaryKeywords: string;
  internalLinks: string;
  externalReferences: string;
  featuredImageUrl: string;
  imageAlt: string;
  author: string;
  category: string;
};

function fromBlog(b: MarketingBlog): Draft {
  return {
    title: b.title || '',
    slug: b.slug || '',
    excerpt: b.excerpt || '',
    introduction: b.introduction || '',
    body: b.body || (b.sections ? JSON.stringify(b.sections, null, 2) : ''),
    conclusion: b.conclusion || '',
    cta: b.cta || '',
    seoTitle: b.seoTitle || '',
    metaDescription: b.metaDescription || '',
    targetKeyword: b.targetKeyword || '',
    secondaryKeywords: b.secondaryKeywords || '',
    internalLinks: b.internalLinks || '',
    externalReferences: b.externalReferences || '',
    featuredImageUrl: b.featuredImageUrl || '',
    imageAlt: b.imageAlt || '',
    author: b.author || 'FitNixTrack Team',
    category: b.category || 'Guides',
  };
}

export default function MarketingBlogEditorPage() {
  const params = useParams();
  const gymId = String(params.gymId);
  const blogId = String(params.blogId);
  const { alert, showAlert, closeAlert } = useAlert();
  const [gymName, setGymName] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blog, setBlog] = useState<MarketingBlog | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, overview] = await Promise.all([
        getMarketingBlog(blogId),
        getMarketingOverview(gymId).catch(() => null),
      ]);
      setBlog(b);
      setDraft(fromBlog(b));
      if (overview?.gym?.name) setGymName(overview.gym.name);
    } catch (e) {
      showAlert('error', 'Blog', mapPlatformErrorToUserMessage(e));
    } finally {
      setLoading(false);
    }
  }, [blogId, gymId, showAlert]);

  useEffect(() => {
    void load();
  }, [load]);

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    try {
      let sections = blog?.sections ?? null;
      try {
        const parsed = JSON.parse(draft.body);
        if (Array.isArray(parsed)) sections = parsed;
      } catch {
        // keep body as freeform text
      }
      const updated = await updateMarketingBlog(blogId, {
        title: draft.title,
        slug: draft.slug,
        excerpt: draft.excerpt || null,
        introduction: draft.introduction || null,
        body: draft.body || null,
        sections,
        conclusion: draft.conclusion || null,
        cta: draft.cta || null,
        seoTitle: draft.seoTitle || null,
        metaDescription: draft.metaDescription || null,
        targetKeyword: draft.targetKeyword || null,
        secondaryKeywords: draft.secondaryKeywords || null,
        internalLinks: draft.internalLinks || null,
        externalReferences: draft.externalReferences || null,
        featuredImageUrl: draft.featuredImageUrl || null,
        imageAlt: draft.imageAlt || null,
        author: draft.author || null,
        category: draft.category || null,
      });
      setBlog(updated);
      setDraft(fromBlog(updated));
      showAlert('success', 'Saved', 'Blog draft updated. Not published to the website.');
    } catch (err) {
      showAlert('error', 'Save failed', mapPlatformErrorToUserMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    setBusy(true);
    try {
      const updated = await approveMarketingBlog(blogId);
      setBlog(updated);
      showAlert('success', 'Approved', 'Ready to publish to the FitNixTrack website when you choose.');
    } catch (e) {
      showAlert('error', 'Approve failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handlePublishWebsite() {
    setConfirmPublish(false);
    setBusy(true);
    try {
      const updated = await publishMarketingBlogToWebsite(blogId);
      setBlog(updated);
      showAlert(
        'success',
        'Published to website',
        'Integrated with the existing FitNixTrack blog architecture.'
      );
    } catch (e) {
      showAlert('error', 'Website publish failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !draft) {
    return <Loading message="Loading blog…" fullScreen size="md" />;
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
        isOpen={confirmPublish}
        title="Publish to FitNixTrack website?"
        message="This updates the existing public blog (fitnixTrack_website). Do not invent stats or fake references. Explicit Super Admin action only."
        confirmText="Publish to website"
        type="warning"
        onConfirm={() => void handlePublishWebsite()}
        onClose={() => setConfirmPublish(false)}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/platform/marketing/${gymId}/blogs`}
          className="text-sm text-dark-gray-light underline-offset-2 hover:underline"
        >
          ← Blogs
        </Link>
        <span className="text-xs text-dark-gray-light">
          Status: {blog?.status}
          {blog?.websitePublished ? ' · live on website' : ''}
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={saving || busy} className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleApprove()}
            className="rounded-lg border border-light-gray-dark px-4 py-2 text-sm disabled:opacity-60"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={busy || blog?.status === 'DRAFT'}
            onClick={() => setConfirmPublish(true)}
            className="rounded-lg border border-primary bg-primary/15 px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            Publish to website
          </button>
        </div>

        <section className="rounded-xl border border-light-gray-dark bg-white p-6 shadow">
          <h2 className="font-semibold">Article</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm md:col-span-2">
              Title
              <input className={`${inputClass} mt-1`} value={draft.title} onChange={(e) => setField('title', e.target.value)} required />
            </label>
            <label className="block text-sm">
              Slug
              <input className={`${inputClass} mt-1`} value={draft.slug} onChange={(e) => setField('slug', e.target.value)} required />
            </label>
            <label className="block text-sm">
              Category
              <input className={`${inputClass} mt-1`} value={draft.category} onChange={(e) => setField('category', e.target.value)} />
            </label>
            <label className="block text-sm md:col-span-2">
              Excerpt
              <textarea className={`${areaClass} mt-1`} value={draft.excerpt} onChange={(e) => setField('excerpt', e.target.value)} />
            </label>
            <label className="block text-sm md:col-span-2">
              Introduction
              <textarea className={`${areaClass} mt-1`} value={draft.introduction} onChange={(e) => setField('introduction', e.target.value)} />
            </label>
            <label className="block text-sm md:col-span-2">
              Body / sections JSON
              <span className="block text-xs text-dark-gray-light">
                Prefer website-compatible sections JSON (heading, paragraphs, bullets). No fake stats.
              </span>
              <textarea className={`${areaClass} mt-1 min-h-[220px] font-mono text-xs`} value={draft.body} onChange={(e) => setField('body', e.target.value)} />
            </label>
            <label className="block text-sm">
              Conclusion
              <textarea className={`${areaClass} mt-1`} value={draft.conclusion} onChange={(e) => setField('conclusion', e.target.value)} />
            </label>
            <label className="block text-sm">
              CTA
              <textarea className={`${areaClass} mt-1`} value={draft.cta} onChange={(e) => setField('cta', e.target.value)} />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-light-gray-dark bg-white p-6 shadow">
          <h2 className="font-semibold">SEO / AEO</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              SEO title
              <input className={`${inputClass} mt-1`} value={draft.seoTitle} onChange={(e) => setField('seoTitle', e.target.value)} />
            </label>
            <label className="block text-sm">
              Author
              <input className={`${inputClass} mt-1`} value={draft.author} onChange={(e) => setField('author', e.target.value)} />
            </label>
            <label className="block text-sm md:col-span-2">
              Meta description
              <textarea className={`${areaClass} mt-1`} value={draft.metaDescription} onChange={(e) => setField('metaDescription', e.target.value)} />
            </label>
            <label className="block text-sm">
              Target keyword
              <input className={`${inputClass} mt-1`} value={draft.targetKeyword} onChange={(e) => setField('targetKeyword', e.target.value)} />
            </label>
            <label className="block text-sm">
              Secondary keywords
              <input className={`${inputClass} mt-1`} value={draft.secondaryKeywords} onChange={(e) => setField('secondaryKeywords', e.target.value)} />
            </label>
            <label className="block text-sm">
              Internal links
              <textarea className={`${areaClass} mt-1`} value={draft.internalLinks} onChange={(e) => setField('internalLinks', e.target.value)} />
            </label>
            <label className="block text-sm">
              External references
              <textarea className={`${areaClass} mt-1`} value={draft.externalReferences} onChange={(e) => setField('externalReferences', e.target.value)} />
            </label>
            <label className="block text-sm">
              Featured image URL
              <input className={`${inputClass} mt-1`} value={draft.featuredImageUrl} onChange={(e) => setField('featuredImageUrl', e.target.value)} />
            </label>
            <label className="block text-sm">
              Image alt text
              <input className={`${inputClass} mt-1`} value={draft.imageAlt} onChange={(e) => setField('imageAlt', e.target.value)} />
            </label>
          </div>
        </section>
      </form>
    </div>
  );
}

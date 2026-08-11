'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  generateMarketingBlog,
  getMarketingOverview,
  listMarketingBlogs,
} from '@/lib/platform/marketingApi';
import type { MarketingBlog } from '@/lib/platform/marketingTypes';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import MarketingSubNav from '@/components/platform/marketing/MarketingSubNav';
import Loading from '@/components/Loading';
import Alert from '@/components/Alert';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { useAlert } from '@/hooks/useAlert';

const statusTone: Record<string, string> = {
  DRAFT: 'bg-light-gray text-dark-gray',
  AWAITING_REVIEW: 'bg-warning/20 text-warning-dark',
  APPROVED: 'bg-primary/20 text-ink',
  PUBLISHED: 'bg-primary/30 text-ink',
  REJECTED: 'bg-error-light/30 text-error-dark',
};

export default function MarketingBlogsPage() {
  const params = useParams();
  const gymId = String(params.gymId);
  const { alert, showAlert, closeAlert } = useAlert();
  const [gymName, setGymName] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [confirmGen, setConfirmGen] = useState(false);
  const [topic, setTopic] = useState('');
  const [keyword, setKeyword] = useState('');
  const [blogs, setBlogs] = useState<MarketingBlog[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, overview] = await Promise.all([
        listMarketingBlogs(gymId, { page: 1, limit: 50 }),
        getMarketingOverview(gymId).catch(() => null),
      ]);
      setBlogs(list.blogs || []);
      if (overview?.gym?.name) setGymName(overview.gym.name);
    } catch (e) {
      setBlogs([]);
      showAlert('error', 'Blogs', mapPlatformErrorToUserMessage(e));
    } finally {
      setLoading(false);
    }
  }, [gymId, showAlert]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleGenerate() {
    setConfirmGen(false);
    setGenerating(true);
    try {
      const blog = await generateMarketingBlog(gymId, {
        topic: topic.trim() || undefined,
        targetKeyword: keyword.trim() || undefined,
      });
      showAlert(
        'success',
        'Draft created',
        'Blog draft ready for review. Nothing was published to the website.'
      );
      window.location.href = `/platform/marketing/${gymId}/blogs/${blog.id}`;
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
        isOpen={confirmGen}
        title="Generate blog draft?"
        message="AI will draft an SEO/AEO-friendly article from the marketing profile. You must review and explicitly publish to the FitNixTrack website."
        confirmText={generating ? 'Generating…' : 'Generate draft'}
        type="info"
        onConfirm={() => void handleGenerate()}
        onClose={() => setConfirmGen(false)}
      />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-dark-gray">Blogs & SEO</h2>
          <p className="mt-1 text-sm text-dark-gray-light">
            Quality over volume. Integrates with the existing FitNixTrack public blog — no second
            public blog system.
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-3 rounded-xl border border-light-gray-dark bg-white p-4 shadow md:grid-cols-3">
        <label className="block text-sm md:col-span-1">
          <span className="font-medium">Topic (optional)</span>
          <input
            className="mt-1 w-full rounded-lg border border-light-gray-dark px-3 py-2 text-sm"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. biometric gym attendance"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Target keyword (optional)</span>
          <input
            className="mt-1 w-full rounded-lg border border-light-gray-dark px-3 py-2 text-sm"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="gym management software Pakistan"
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            disabled={generating}
            onClick={() => setConfirmGen(true)}
            className="btn-primary w-full rounded-lg px-4 py-2 text-sm disabled:opacity-60"
          >
            {generating ? 'Generating…' : 'Generate blog draft'}
          </button>
        </div>
      </div>

      {loading || generating ? (
        <Loading message={generating ? 'AI drafting blog…' : 'Loading blogs…'} size="md" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-light-gray-dark bg-white shadow">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-[#f8f8f8] text-xs uppercase text-dark-gray-light">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Keyword</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {blogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-dark-gray-light">
                    No blog drafts yet.
                  </td>
                </tr>
              ) : (
                blogs.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{b.title}</td>
                    <td className="px-4 py-3 text-dark-gray-light">{b.slug}</td>
                    <td className="px-4 py-3 text-dark-gray-light">{b.targetKeyword || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusTone[b.status] || 'bg-light-gray'
                        }`}
                      >
                        {b.status}
                        {b.websitePublished ? ' · live' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/platform/marketing/${gymId}/blogs/${b.id}`}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white"
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

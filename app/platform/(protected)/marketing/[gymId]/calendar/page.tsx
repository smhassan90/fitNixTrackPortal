'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  cancelMarketingSchedule,
  duplicateMarketingContent,
  getMarketingCalendar,
  getMarketingOverview,
  rescheduleMarketingContent,
} from '@/lib/platform/marketingApi';
import type { MarketingCalendarItem } from '@/lib/platform/marketingTypes';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import MarketingSubNav from '@/components/platform/marketing/MarketingSubNav';
import { ContentStatusBadge } from '@/components/platform/marketing/MarketingStatusBadges';
import Loading from '@/components/Loading';
import Alert from '@/components/Alert';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { useAlert } from '@/hooks/useAlert';

type ViewMode = 'month' | 'week' | 'list';

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function toInputDateTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MarketingCalendarPage() {
  const params = useParams();
  const gymId = String(params.gymId);
  const { alert, showAlert, closeAlert } = useAlert();
  const [gymName, setGymName] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
  const [anchor, setAnchor] = useState(() => startOfMonth(new Date()));
  const [items, setItems] = useState<MarketingCalendarItem[]>([]);
  const [rescheduleTarget, setRescheduleTarget] = useState<MarketingCalendarItem | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState('');
  const [cancelTarget, setCancelTarget] = useState<MarketingCalendarItem | null>(null);

  const range = useMemo(() => {
    if (view === 'week') {
      const day = anchor.getDay();
      const start = addDays(anchor, -day);
      const end = addDays(start, 7);
      return { start, end };
    }
    if (view === 'month') {
      const start = startOfMonth(anchor);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      return { start, end };
    }
    const start = addDays(new Date(), -7);
    const end = addDays(new Date(), 60);
    return { start, end };
  }, [anchor, view]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cal, overview] = await Promise.all([
        getMarketingCalendar({
          gymId,
          view,
          from: range.start.toISOString(),
          to: range.end.toISOString(),
        }),
        getMarketingOverview(gymId).catch(() => null),
      ]);
      setItems(cal.items || []);
      if (overview?.gym?.name) setGymName(overview.gym.name);
    } catch (e) {
      setItems([]);
      showAlert('error', 'Calendar', mapPlatformErrorToUserMessage(e));
    } finally {
      setLoading(false);
    }
  }, [gymId, range.end, range.start, showAlert, view]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleReschedule() {
    if (!rescheduleTarget || !rescheduleAt) return;
    const id = rescheduleTarget.contentId;
    setRescheduleTarget(null);
    try {
      await rescheduleMarketingContent(id, {
        scheduledAt: new Date(rescheduleAt).toISOString(),
      });
      showAlert('success', 'Rescheduled', 'Schedule updated.');
      await load();
    } catch (e) {
      showAlert('error', 'Reschedule failed', mapPlatformErrorToUserMessage(e));
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    const id = cancelTarget.contentId;
    setCancelTarget(null);
    try {
      await cancelMarketingSchedule(id);
      showAlert('success', 'Cancelled', 'Schedule cancelled.');
      await load();
    } catch (e) {
      showAlert('error', 'Cancel failed', mapPlatformErrorToUserMessage(e));
    }
  }

  async function handleDuplicate(contentId: number) {
    try {
      const dup = await duplicateMarketingContent(contentId);
      showAlert('success', 'Duplicated', 'Draft copy created.');
      window.location.href = `/platform/marketing/${gymId}/content/${dup.id}`;
    } catch (e) {
      showAlert('error', 'Duplicate failed', mapPlatformErrorToUserMessage(e));
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
        isOpen={!!cancelTarget}
        title="Cancel scheduled post?"
        message="The post will leave the schedule. Content draft is kept."
        confirmText="Cancel schedule"
        type="danger"
        onConfirm={() => void handleCancel()}
        onClose={() => setCancelTarget(null)}
      />

      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setRescheduleTarget(null)} />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Reschedule</h3>
            <input
              type="datetime-local"
              className="mt-3 w-full rounded-lg border border-light-gray-dark px-3 py-2 text-sm"
              value={rescheduleAt}
              onChange={(e) => setRescheduleAt(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={() => setRescheduleTarget(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-primary rounded-lg px-3 py-2 text-sm"
                onClick={() => void handleReschedule()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-dark-gray">Content calendar</h2>
          <p className="text-sm text-dark-gray-light">Scheduled and published posts for this gym.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['month', 'week', 'list'] as ViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
                view === v ? 'bg-primary text-white' : 'border border-light-gray-dark bg-white'
              }`}
            >
              {v}
            </button>
          ))}
          {view !== 'list' && (
            <>
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-xs"
                onClick={() =>
                  setAnchor((a) =>
                    view === 'week'
                      ? addDays(a, -7)
                      : new Date(a.getFullYear(), a.getMonth() - 1, 1)
                  )
                }
              >
                Prev
              </button>
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-xs"
                onClick={() =>
                  setAnchor((a) =>
                    view === 'week'
                      ? addDays(a, 7)
                      : new Date(a.getFullYear(), a.getMonth() + 1, 1)
                  )
                }
              >
                Next
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <Loading message="Loading calendar…" size="md" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-light-gray-dark bg-white shadow">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-[#f8f8f8] text-xs uppercase text-dark-gray-light">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-dark-gray-light">
                    No scheduled or published items in this range.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={`${item.id}-${item.platform}`} className="border-b last:border-0">
                    <td className="px-4 py-3 text-dark-gray-light">
                      {item.scheduledAt
                        ? new Date(item.scheduledAt).toLocaleString()
                        : item.publishedAt
                          ? new Date(item.publishedAt).toLocaleString()
                          : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium">{item.title}</td>
                    <td className="px-4 py-3 capitalize">
                      {item.platform?.replace(/_/g, ' ') || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <ContentStatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/platform/marketing/${gymId}/content/${item.contentId}`}
                          className="text-xs underline"
                        >
                          Edit
                        </Link>
                        {item.status === 'SCHEDULED' && (
                          <>
                            <button
                              type="button"
                              className="text-xs underline"
                              onClick={() => {
                                setRescheduleTarget(item);
                                setRescheduleAt(toInputDateTime(item.scheduledAt));
                              }}
                            >
                              Reschedule
                            </button>
                            <button
                              type="button"
                              className="text-xs text-error-dark underline"
                              onClick={() => setCancelTarget(item)}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="text-xs underline"
                          onClick={() => void handleDuplicate(item.contentId)}
                        >
                          Duplicate
                        </button>
                      </div>
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

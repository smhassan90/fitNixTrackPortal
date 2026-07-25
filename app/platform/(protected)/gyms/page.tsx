'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  activatePlatformGym,
  listPlatformGyms,
  suspendPlatformGym,
} from '@/lib/platform/platformApi';
import type { PlatformGymRow } from '@/lib/platform/types';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import Loading from '@/components/Loading';
import { useIsPlatformSuperAdmin } from '@/contexts/PlatformAuthContext';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import Alert from '@/components/Alert';
import { useAlert } from '@/hooks/useAlert';

type StatusFilter = '' | 'ACTIVE' | 'SUSPENDED';
type SortBy = 'name' | 'createdAt' | 'dueDate';
type SortOrder = 'asc' | 'desc';

type FilterDraft = {
  search: string;
  status: StatusFilter;
  planId: string;
  dueFrom: string;
  dueTo: string;
};

function normalizeDateLike(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (typeof value === 'number') return new Date(value).toISOString().slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const nested = o.iso ?? o.value ?? o.date ?? o.dueDate ?? o.$date;
    if (typeof nested === 'string') return nested.slice(0, 10);
  }
  return '';
}

const emptyFilters: FilterDraft = {
  search: '',
  status: '',
  planId: '',
  dueFrom: '',
  dueTo: '',
};

export default function PlatformGymsPage() {
  const isSuper = useIsPlatformSuperAdmin();
  const { alert, showAlert, closeAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PlatformGymRow[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [draft, setDraft] = useState<FilterDraft>(emptyFilters);
  const [applied, setApplied] = useState<FilterDraft>(emptyFilters);
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [confirm, setConfirm] = useState<{ id: string | number; action: 'suspend' | 'activate' } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params: Record<string, string | number | undefined> = {
          page: pagination.page,
          limit: Math.min(pagination.limit, 100),
          sortBy,
          sortOrder,
        };
        if (applied.search.trim()) params.search = applied.search.trim();
        if (applied.status) params.status = applied.status;
        if (applied.planId.trim()) {
          const n = Number(applied.planId);
          if (!Number.isNaN(n) && n > 0) params.planId = n;
        }
        if (applied.dueFrom) params.dueFrom = applied.dueFrom;
        if (applied.dueTo) params.dueTo = applied.dueTo;
        const data = await listPlatformGyms(params);
        if (cancelled) return;
        setRows(data.gyms || []);
        const pg = data.pagination;
        if (pg) {
          setPagination((p) => ({
            ...p,
            total: pg.total,
            totalPages: pg.totalPages,
            page: pg.page ?? p.page,
          }));
        }
      } catch (e) {
        if (!cancelled) {
          showAlert('error', 'Failed to load gyms', mapPlatformErrorToUserMessage(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    applied,
    pagination.page,
    pagination.limit,
    sortBy,
    sortOrder,
    refreshNonce,
    showAlert,
  ]);

  const applyFilters = () => {
    setApplied({ ...draft });
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const runSuspendActivate = async () => {
    if (!confirm) return;
    try {
      if (confirm.action === 'suspend') {
        await suspendPlatformGym(confirm.id);
        showAlert('success', 'Updated', 'This gym is now paused. Their team cannot use the gym apps until you activate them again.');
      } else {
        await activatePlatformGym(confirm.id);
        showAlert('success', 'Updated', 'This gym is active again. Their team can use the gym apps.');
      }
      setConfirm(null);
      setRefreshNonce((n) => n + 1);
    } catch (e) {
      showAlert('error', 'Action failed', mapPlatformErrorToUserMessage(e));
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
      <ConfirmationDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={runSuspendActivate}
        title={confirm?.action === 'suspend' ? 'Suspend gym?' : 'Activate gym?'}
        message={
          confirm?.action === 'suspend'
            ? 'Their staff will be locked out of the gym apps until you turn access back on.'
            : 'Their staff will be able to use the gym apps again.'
        }
        confirmText={confirm?.action === 'suspend' ? 'Suspend' : 'Activate'}
        type={confirm?.action === 'suspend' ? 'danger' : 'info'}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-gray">Gyms</h1>
          <p className="text-sm text-dark-gray-light mt-1">
            Search and manage every gym on the platform — size, billing health, and account status.
          </p>
        </div>
        {isSuper && (
          <Link
            href="/platform/gyms/new"
            className="rounded-lg bg-purple px-4 py-2 text-sm font-medium text-white hover:bg-purple-dark"
          >
            Create gym
          </Link>
        )}
      </div>

      <div className="mt-6 rounded-xl bg-white p-4 shadow border border-light-gray-dark space-y-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <input
            placeholder="Search by gym name"
            value={draft.search}
            onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
            className="rounded-lg border border-light-gray-dark px-3 py-2 text-sm"
          />
          <select
            value={draft.status}
            onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as StatusFilter }))}
            className="rounded-lg border border-light-gray-dark px-3 py-2 text-sm"
          >
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Paused</option>
          </select>
          <input
            placeholder="Billing plan ID"
            value={draft.planId}
            onChange={(e) => setDraft((d) => ({ ...d, planId: e.target.value }))}
            className="rounded-lg border border-light-gray-dark px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={draft.dueFrom}
              onChange={(e) => setDraft((d) => ({ ...d, dueFrom: e.target.value }))}
              className="flex-1 rounded-lg border border-light-gray-dark px-2 py-2 text-sm"
            />
            <input
              type="date"
              value={draft.dueTo}
              onChange={(e) => setDraft((d) => ({ ...d, dueTo: e.target.value }))}
              className="flex-1 rounded-lg border border-light-gray-dark px-2 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-dark-gray-light block">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="rounded-lg border border-light-gray-dark px-3 py-2 text-sm"
            >
              <option value="name">Gym name</option>
              <option value="createdAt">Date added</option>
              <option value="dueDate">Next payment</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-dark-gray-light block">Order</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="rounded-lg border border-light-gray-dark px-3 py-2 text-sm"
            >
              <option value="asc">A → Z / oldest first</option>
              <option value="desc">Z → A / newest first</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-dark-gray-light block">Per page</label>
            <select
              value={pagination.limit}
              onChange={(e) =>
                setPagination((p) => ({ ...p, limit: Number(e.target.value), page: 1 }))
              }
              className="rounded-lg border border-light-gray-dark px-3 py-2 text-sm"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary-dark active:bg-primary-dark"
          >
            Apply
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <Loading message="Loading gyms…" size="md" />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-light-gray-dark bg-white shadow">
          <table className="min-w-full text-sm">
            <thead className="bg-light-gray text-left text-dark-gray-light">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Timezone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Members</th>
                <th className="px-4 py-3">Trainers</th>
                <th className="px-4 py-3">Overdue</th>
                <th className="px-4 py-3">Subscription</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => {
                const suspended =
                  g.tenantStatus === 'SUSPENDED' ||
                  String(g.tenantStatus).toUpperCase() === 'SUSPENDED';
                const row = g as Record<string, unknown>;
                const sub = (g.subscription as Record<string, unknown> | undefined) ?? {};
                const planName = String(row.planName ?? sub.planName ?? row.packageName ?? '—');
                const dueDate = normalizeDateLike(row.dueDate ?? sub.dueDate);
                const timezone = g.timezone != null ? String(g.timezone) : '';
                return (
                  <tr key={String(g.id)} className="border-t border-light-gray">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/platform/gyms/${g.id}`} className="text-primary hover:underline">
                        {g.name}
                      </Link>
                      {g.slug && (
                        <span className="block text-xs text-dark-gray-light font-normal">{g.slug}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-dark-gray-light">
                      {timezone || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {suspended ? (
                        <span className="rounded-full bg-error-light px-2 py-0.5 text-xs text-error-dark">
                          Paused
                        </span>
                      ) : (
                        <span className="rounded-full bg-success-light px-2 py-0.5 text-xs text-success-dark">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{g.membersCount ?? '—'}</td>
                    <td className="px-4 py-3">{g.trainersCount ?? '—'}</td>
                    <td className="px-4 py-3">{g.overdueAmount ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      <div>{planName}</div>
                      <div className="text-dark-gray-light">Due {dueDate || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      <Link
                        href={`/platform/gyms/${g.id}`}
                        className="text-primary hover:underline"
                      >
                        View
                      </Link>
                      {isSuper && (
                        <>
                          {suspended ? (
                            <button
                              type="button"
                              className="text-success-dark hover:underline"
                              onClick={() => setConfirm({ id: g.id, action: 'activate' })}
                            >
                              Activate
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="text-error hover:underline"
                              onClick={() => setConfirm({ id: g.id, action: 'suspend' })}
                            >
                              Suspend
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-dark-gray-light">
                    No gyms found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm">
        <button
          type="button"
          disabled={pagination.page <= 1}
          onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
          className="rounded border px-3 py-1 disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-dark-gray-light">
          Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
        </span>
        <button
          type="button"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() =>
            setPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))
          }
          className="rounded border px-3 py-1 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </>
  );
}

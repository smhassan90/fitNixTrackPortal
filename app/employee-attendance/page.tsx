'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@/components/Alert';
import Layout from '@/components/Layout';
import Loading from '@/components/Loading';
import { useAuth } from '@/contexts/AuthContext';
import { useGymTimezone } from '@/contexts/GymSettingsContext';
import { useAlert } from '@/hooks/useAlert';
import {
  bulkMarkEmployeeAttendance,
  employeeAttendanceErrorMessage,
  fetchEmployeeAttendanceDaily,
  fetchEmployeeAttendanceEmployees,
  fetchEmployeeAttendanceHistory,
  type EmployeeAttendanceOption,
  type EmployeeAttendanceRecord,
  type EmployeeAttendanceStatus,
  type EmployeeDailyAttendance,
} from '@/lib/employeeAttendanceApi';
import { EMPLOYEE_PERMISSION_KEYS } from '@/lib/employeePermissions';
import { formatDate } from '@/lib/dateUtils';
import { displayAttendanceTime } from '@/lib/gymTimezone';
import { getErrorMessage } from '@/lib/errorHandler';

type Tab = 'daily' | 'history';

type DraftRow = {
  status: EmployeeAttendanceStatus | '';
  notes: string;
  dirty: boolean;
};

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function statusBadge(status: EmployeeAttendanceStatus | null | undefined) {
  if (!status) {
    return (
      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
        Not marked
      </span>
    );
  }
  if (status === 'PRESENT') {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
        Present
      </span>
    );
  }
  if (status === 'LATE') {
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
        Late
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
      Absent
    </span>
  );
}

export default function EmployeeAttendancePage() {
  const { can } = useAuth();
  const gymTimezone = useGymTimezone();
  const canRead = can(EMPLOYEE_PERMISSION_KEYS.attendanceRead);
  const canManage = can(EMPLOYEE_PERMISSION_KEYS.attendanceManage);
  const canEmployees = can(EMPLOYEE_PERMISSION_KEYS.read);
  const { alert, showAlert, closeAlert } = useAlert();

  const [tab, setTab] = useState<Tab>('daily');
  const [date, setDate] = useState(todayYmd);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [daily, setDaily] = useState<EmployeeDailyAttendance | null>(null);
  const [drafts, setDrafts] = useState<Record<number, DraftRow>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [historyStart, setHistoryStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [historyEnd, setHistoryEnd] = useState(todayYmd);
  const [historyEmployeeId, setHistoryEmployeeId] = useState<number | ''>('');
  const [historyStatus, setHistoryStatus] = useState<EmployeeAttendanceStatus | ''>('');
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeAttendanceOption[]>([]);
  const [history, setHistory] = useState<EmployeeAttendanceRecord[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadDaily = useCallback(async () => {
    if (!canRead) {
      setDaily(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchEmployeeAttendanceDaily({
        date,
        includeInactive,
      });
      setDaily(data);
      const next: Record<number, DraftRow> = {};
      for (const row of data.roster) {
        next[row.employeeId] = {
          status: row.status ?? '',
          notes: row.notes ?? '',
          dirty: false,
        };
      }
      setDrafts(next);
    } catch (e: unknown) {
      showAlert('error', 'Could not load attendance', getErrorMessage(e) || employeeAttendanceErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [canRead, date, includeInactive, showAlert]);

  const loadHistory = useCallback(async () => {
    if (!canRead) return;
    setHistoryLoading(true);
    try {
      const result = await fetchEmployeeAttendanceHistory({
        startDate: historyStart || undefined,
        endDate: historyEnd || undefined,
        employeeId: historyEmployeeId || undefined,
        status: historyStatus || undefined,
        page: historyPage,
        limit: 50,
        sortBy: 'date',
        sortOrder: 'desc',
      });
      setHistory(result.records);
      setHistoryTotalPages(result.pagination.totalPages);
    } catch (e: unknown) {
      showAlert('error', 'Could not load history', getErrorMessage(e) || employeeAttendanceErrorMessage(e));
    } finally {
      setHistoryLoading(false);
    }
  }, [
    canRead,
    historyStart,
    historyEnd,
    historyEmployeeId,
    historyStatus,
    historyPage,
    showAlert,
  ]);

  useEffect(() => {
    if (tab === 'daily') void loadDaily();
  }, [tab, loadDaily]);

  useEffect(() => {
    if (tab === 'history') void loadHistory();
  }, [tab, loadHistory]);

  useEffect(() => {
    if (!canRead) return;
    void fetchEmployeeAttendanceEmployees()
      .then(setEmployeeOptions)
      .catch(() => setEmployeeOptions([]));
  }, [canRead]);

  const dirtyCount = useMemo(
    () => Object.values(drafts).filter((d) => d.dirty && d.status).length,
    [drafts]
  );

  const updateDraft = (employeeId: number, patch: Partial<DraftRow>) => {
    setDrafts((prev) => {
      const cur = prev[employeeId] ?? { status: '', notes: '', dirty: false };
      return {
        ...prev,
        [employeeId]: { ...cur, ...patch, dirty: true },
      };
    });
  };

  const handleSaveAll = async () => {
    if (!canManage || !daily) return;
    const records = daily.roster
      .map((row) => {
        const draft = drafts[row.employeeId];
        if (!draft?.dirty || !draft.status) return null;
        if (!row.isActive) return null;
        // Never invent check-in/out times — those come from the attendance device only.
        // ABSENT clears times; PRESENT/LATE only update status/notes.
        if (draft.status === 'ABSENT') {
          return {
            employeeId: row.employeeId,
            status: 'ABSENT' as const,
            notes: draft.notes.trim() || null,
            checkInTime: null,
            checkOutTime: null,
          };
        }
        return {
          employeeId: row.employeeId,
          status: draft.status as EmployeeAttendanceStatus,
          notes: draft.notes.trim() || null,
        };
      })
      .filter(Boolean) as Array<{
      employeeId: number;
      status: EmployeeAttendanceStatus;
      notes: string | null;
      checkInTime?: string | null;
      checkOutTime?: string | null;
    }>;

    if (records.length === 0) {
      showAlert('info', 'Nothing to save', 'Change status on one or more rows first.');
      return;
    }

    setSaving(true);
    try {
      const result = await bulkMarkEmployeeAttendance({
        date: daily.date || date,
        records,
      });
      showAlert('success', 'Attendance saved', `Marked ${result.marked} employee(s).`);
      await loadDaily();
    } catch (e: unknown) {
      showAlert('error', 'Save failed', getErrorMessage(e) || employeeAttendanceErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!canRead) {
    return (
      <Layout>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900">
          You need employee attendance permission to view this page.
        </div>
      </Layout>
    );
  }

  const summary = daily?.summary;

  return (
    <Layout>
      <Alert
        isOpen={alert.isOpen}
        onClose={closeAlert}
        type={alert.type}
        title={alert.title}
        message={alert.message}
      />

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-dark-gray">Staff attendance</h1>
          <p className="mt-1 text-sm text-gray-500">
            Employee attendance only — separate from member check-ins. Check-in and check-out times
            come from the attendance device; the portal can mark Present / Late / Absent and notes.
          </p>
        </div>
        {canEmployees && (
          <Link
            href="/employees"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Employee roster
          </Link>
        )}
      </div>

      <div className="mb-4 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
        <button
          type="button"
          onClick={() => setTab('daily')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium ${
            tab === 'daily' ? 'bg-white text-primary shadow-sm' : 'text-gray-600'
          }`}
        >
          Daily
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium ${
            tab === 'history' ? 'bg-white text-primary shadow-sm' : 'text-gray-600'
          }`}
        >
          History
        </button>
      </div>

      {tab === 'daily' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              Include inactive
            </label>
            <button
              type="button"
              onClick={() => void loadDaily()}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
            >
              Refresh
            </button>
            {canManage && (
              <button
                type="button"
                disabled={saving || dirtyCount === 0}
                onClick={() => void handleSaveAll()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {saving ? 'Saving…' : `Save all${dirtyCount ? ` (${dirtyCount})` : ''}`}
              </button>
            )}
          </div>

          {summary && (
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Present', value: summary.present, className: 'bg-emerald-50 text-emerald-800' },
                { label: 'Late', value: summary.late, className: 'bg-amber-50 text-amber-800' },
                { label: 'Absent', value: summary.absent, className: 'bg-red-50 text-red-800' },
                { label: 'Not marked', value: summary.notMarked, className: 'bg-gray-100 text-gray-700' },
                { label: 'Checked in', value: summary.checkedIn, className: 'bg-sky-50 text-sky-800' },
              ].map((chip) => (
                <span
                  key={chip.label}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${chip.className}`}
                >
                  {chip.label}: {chip.value}
                </span>
              ))}
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-600 shadow-sm">
                Total: {summary.totalEmployees}
              </span>
            </div>
          )}

          {loading ? (
            <Loading message="Loading daily roster…" />
          ) : (
            <div className="overflow-hidden rounded-lg bg-white shadow">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-light-gray">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase">Employee ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase">Employee</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase">Designation</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase">
                        Check-in (device)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase">
                        Check-out (device)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {!daily?.roster.length ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                          No employees on roster for this date.
                        </td>
                      </tr>
                    ) : (
                      daily.roster.map((row) => {
                        const draft = drafts[row.employeeId] ?? {
                          status: row.status ?? '',
                          notes: row.notes ?? '',
                          dirty: false,
                        };
                        return (
                          <tr
                            key={row.employeeId}
                            className={row.isActive ? 'hover:bg-gray-50' : 'bg-gray-50 text-gray-500'}
                          >
                            <td className="px-4 py-3 font-mono text-sm font-semibold text-dark-gray">
                              {row.employeeId}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-dark-gray">{row.employee}</div>
                              {row.contact ? (
                                <div className="text-xs text-gray-500">{row.contact}</div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{row.designation || '—'}</td>
                            <td className="px-4 py-3">
                              {canManage && row.isActive ? (
                                <select
                                  value={draft.status}
                                  onChange={(e) =>
                                    updateDraft(row.employeeId, {
                                      status: e.target.value as EmployeeAttendanceStatus | '',
                                    })
                                  }
                                  className="rounded border px-2 py-1 text-xs"
                                >
                                  <option value="">Not marked</option>
                                  <option value="PRESENT">Present</option>
                                  <option value="LATE">Late</option>
                                  <option value="ABSENT">Absent</option>
                                </select>
                              ) : (
                                statusBadge(row.status)
                              )}
                              {draft.dirty && (
                                <span className="ml-2 text-[10px] font-semibold text-amber-700">
                                  unsaved
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {displayAttendanceTime(row.checkIn, row.checkInTime, gymTimezone)}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {displayAttendanceTime(row.checkOut, row.checkOutTime, gymTimezone)}
                            </td>
                            <td className="px-4 py-3">
                              {canManage && row.isActive ? (
                                <input
                                  value={draft.notes}
                                  onChange={(e) =>
                                    updateDraft(row.employeeId, { notes: e.target.value })
                                  }
                                  className="w-36 rounded border px-2 py-1 text-xs"
                                  placeholder="Notes"
                                />
                              ) : (
                                row.notes || '—'
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">From</label>
              <input
                type="date"
                value={historyStart}
                onChange={(e) => {
                  setHistoryStart(e.target.value);
                  setHistoryPage(1);
                }}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">To</label>
              <input
                type="date"
                value={historyEnd}
                onChange={(e) => {
                  setHistoryEnd(e.target.value);
                  setHistoryPage(1);
                }}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Employee</label>
              <select
                value={historyEmployeeId}
                onChange={(e) => {
                  setHistoryEmployeeId(e.target.value ? Number(e.target.value) : '');
                  setHistoryPage(1);
                }}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">All</option>
                {employeeOptions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label || e.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
              <select
                value={historyStatus}
                onChange={(e) => {
                  setHistoryStatus((e.target.value as EmployeeAttendanceStatus) || '');
                  setHistoryPage(1);
                }}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="PRESENT">Present</option>
                <option value="LATE">Late</option>
                <option value="ABSENT">Absent</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => void loadHistory()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              Apply
            </button>
          </div>

          {historyLoading ? (
            <Loading message="Loading history…" />
          ) : (
            <div className="overflow-hidden rounded-lg bg-white shadow">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-light-gray">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">Check-in</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">Check-out</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                        No attendance records found.
                      </td>
                    </tr>
                  ) : (
                    history.map((rec) => (
                      <tr key={rec.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{formatDate(rec.date)}</td>
                        <td className="px-4 py-3 font-medium">
                          {rec.employeeName || `#${rec.employeeId}`}
                        </td>
                        <td className="px-4 py-3">{statusBadge(rec.status)}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {displayAttendanceTime(rec.checkIn, rec.checkInTime, gymTimezone)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {displayAttendanceTime(rec.checkOut, rec.checkOutTime, gymTimezone)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{rec.notes || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {historyTotalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
                  <span className="text-gray-500">
                    Page {historyPage} of {historyTotalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={historyPage <= 1}
                      onClick={() => setHistoryPage((p) => p - 1)}
                      className="rounded border px-2 py-1 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={historyPage >= historyTotalPages}
                      onClick={() => setHistoryPage((p) => p + 1)}
                      className="rounded border px-2 py-1 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Layout from '@/components/Layout';
import Alert from '@/components/Alert';
import { FilterBarSkeleton, TableSkeleton } from '@/components/Skeleton';
import DeviceSyncPanel from '@/components/DeviceSyncPanel';
import { formatDate } from '@/lib/dateUtils';
import { useAlert } from '@/hooks/useAlert';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errorHandler';
import {
  exportNoSignInCsv,
  fetchNoSignInReport,
  type NoSignInReport,
} from '@/lib/attendanceApi';
import { displayMemberId, normalizeMemberNumberFields } from '@/lib/displayMemberId';
import {
  fetchOverdueCheckins,
  normalizeOverduePaymentInfo,
  overdueDetailsText,
  type OverduePaymentInfo,
} from '@/lib/overdueAlerts';
import OverdueCheckinToasts, {
  useOverdueCheckinToasts,
} from '@/components/OverdueCheckinToasts';

type AttendanceTab = 'history' | 'no-sign-in' | 'sync-users';

const VALID_TABS: AttendanceTab[] = ['history', 'no-sign-in', 'sync-users'];

interface MemberOption {
  id: number;
  memberNumber: string | null;
  name: string;
  label: string;
  contact: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  memberId: number;
  memberNumber: string | null;
  legacyMemberId: string | null;
  member: string;
  contact: string;
  checkIn: string | null;
  checkOut: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
  duration: number | null;
  durationFormatted: string | null;
  memberDetails: {
    email: string | null;
    phone: string | null;
  };
  hasOverduePayment: boolean;
  overduePayment: OverduePaymentInfo | null;
}

interface AttendanceFilters {
  memberId?: number;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

function AttendancePageContent() {
  const { alert, showAlert, closeAlert } = useAlert();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<AttendanceTab>(() =>
    tabParam && VALID_TABS.includes(tabParam as AttendanceTab)
      ? (tabParam as AttendanceTab)
      : 'history'
  );

  useEffect(() => {
    if (tabParam && VALID_TABS.includes(tabParam as AttendanceTab)) {
      setActiveTab(tabParam as AttendanceTab);
    }
  }, [tabParam]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AttendanceFilters>({
    memberId: undefined,
    startDate: undefined,
    endDate: undefined,
    sortBy: 'date',
    sortOrder: 'desc',
    page: 1,
    limit: 50,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const prevFiltersRef = useRef(filters);
  const prevSortConfigRef = useRef<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const [noSignInDays, setNoSignInDays] = useState('2');
  const [noSignInReport, setNoSignInReport] = useState<NoSignInReport | null>(null);
  const [noSignInLoading, setNoSignInLoading] = useState(false);
  const [noSignInError, setNoSignInError] = useState<string | null>(null);

  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [expandedOverdueId, setExpandedOverdueId] = useState<string | null>(null);

  const { toasts, pushAlerts, dismissToast } = useOverdueCheckinToasts();
  const overdueSinceRef = useRef<string | null>(null);

  // Background polling for overdue-member check-ins (catches syncs from the
  // tablet agent that don't go through this portal). First call seeds state
  // without toasting; subsequent calls toast new alerts.
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const since = overdueSinceRef.current;
        const result = await fetchOverdueCheckins(since ?? undefined);
        if (cancelled) return;
        overdueSinceRef.current = result.serverTime;
        pushAlerts(result.alerts, { silent: since == null });
      } catch {
        /* best-effort polling; retry on next tick */
      } finally {
        inFlight = false;
      }
    };

    void poll();
    const intervalId = setInterval(() => void poll(), 45_000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [pushAlerts]);

  // Fetch members for filter dropdown
  const fetchMembers = useCallback(async () => {
    try {
      console.log('Fetching members from /api/attendance/members');
      const response = await api.get('/api/attendance/members');
      console.log('Members API Response:', response.data);
      
      if (response.data.success) {
        const membersList = (response.data.data?.members || []) as Record<string, unknown>[];
        console.log('Received members:', membersList.length);
        setMembers(
          membersList.map((m) => {
            const nums = normalizeMemberNumberFields(m);
            const id = Number(m.id);
            const name = String(m.name ?? '');
            const displayId = displayMemberId(nums);
            const apiLabel = m.label != null ? String(m.label) : '';
            // Prefer API label when it already uses the gym ID; otherwise compose one.
            const label =
              apiLabel && displayId !== '—' && !apiLabel.startsWith(`${id} `)
                ? apiLabel
                : displayId !== '—'
                  ? `${displayId} — ${name}`
                  : name || apiLabel || String(id);
            return {
              id,
              memberNumber: nums.memberNumber,
              name,
              label,
              contact: String(m.contact ?? m.phone ?? ''),
            };
          })
        );
      } else {
        console.warn('Members API returned success=false:', response.data);
        setMembers([]);
      }
    } catch (error: any) {
      console.error('Failed to fetch members:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
      });
      setMembers([]);
    }
  }, []);

  // Fetch attendance records
  const fetchAttendance = useCallback(async (currentFilters: AttendanceFilters) => {
    try {
      setLoading(true);
      setApiError(null);
      
      const params = new URLSearchParams();
      
      if (currentFilters.memberId) params.append('memberId', currentFilters.memberId.toString());
      if (currentFilters.startDate) params.append('startDate', currentFilters.startDate);
      if (currentFilters.endDate) params.append('endDate', currentFilters.endDate);
      if (currentFilters.sortBy) params.append('sortBy', currentFilters.sortBy);
      if (currentFilters.sortOrder) params.append('sortOrder', currentFilters.sortOrder);
      if (currentFilters.page) params.append('page', currentFilters.page.toString());
      if (currentFilters.limit) params.append('limit', currentFilters.limit.toString());

      const url = `/api/attendance?${params.toString()}`;
      console.log('Fetching attendance from:', url);
      console.log('Full URL will be:', `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${url}`);
      
      const response = await api.get(url);
      console.log('Attendance API Response:', response.data);
      
      if (response.data.success) {
        const data = response.data.data;
        const recordsList = (data?.records || []) as Record<string, unknown>[];
        console.log('Received attendance records:', recordsList.length);
        setRecords(
          recordsList.map((r) => {
            const nested = r.member && typeof r.member === 'object' ? (r.member as Record<string, unknown>) : null;
            const nums = normalizeMemberNumberFields({
              memberNumber: r.memberNumber ?? nested?.memberNumber,
              legacyMemberId: r.legacyMemberId ?? nested?.legacyMemberId,
            });
            const memberName =
              typeof r.member === 'string'
                ? r.member
                : String(nested?.name ?? r.memberName ?? '');
            return {
              id: String(r.id ?? ''),
              date: String(r.date ?? ''),
              memberId: Number(r.memberId) || 0,
              memberNumber: nums.memberNumber,
              legacyMemberId: nums.legacyMemberId,
              member: memberName,
              contact: String(r.contact ?? ''),
              checkIn: r.checkIn != null ? String(r.checkIn) : null,
              checkOut: r.checkOut != null ? String(r.checkOut) : null,
              checkInTime: r.checkInTime != null ? String(r.checkInTime) : null,
              checkOutTime: r.checkOutTime != null ? String(r.checkOutTime) : null,
              status: (r.status as AttendanceRecord['status']) || 'PRESENT',
              duration: r.duration != null ? Number(r.duration) : null,
              durationFormatted: r.durationFormatted != null ? String(r.durationFormatted) : null,
              memberDetails: {
                email:
                  (r.memberDetails as { email?: string | null } | undefined)?.email != null
                    ? String((r.memberDetails as { email?: string | null }).email)
                    : null,
                phone:
                  (r.memberDetails as { phone?: string | null } | undefined)?.phone != null
                    ? String((r.memberDetails as { phone?: string | null }).phone)
                    : null,
              },
              hasOverduePayment: Boolean(r.hasOverduePayment),
              overduePayment: normalizeOverduePaymentInfo(r.overduePayment),
            } satisfies AttendanceRecord;
          })
        );
        setPagination({
          page: currentFilters.page || 1,
          limit: currentFilters.limit || 50,
          total: data?.pagination?.total || 0,
          totalPages: data?.pagination?.totalPages || 0,
        });
      } else {
        console.warn('API returned success=false:', response.data);
        setRecords([]);
        setApiError('API returned unsuccessful response');
      }
    } catch (error: any) {
      console.error('Error fetching attendance:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
        fullUrl: error.config?.baseURL + error.config?.url,
      });
      const errorMsg = getErrorMessage(error);
      setApiError(errorMsg);
      showAlert('error', 'Error Loading Attendance', errorMsg);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  const fetchNoSignIn = useCallback(
    async (days: number) => {
      try {
        setNoSignInLoading(true);
        setNoSignInError(null);
        const report = await fetchNoSignInReport(days);
        setNoSignInReport(report);
      } catch (error: unknown) {
        const msg = getErrorMessage(error);
        setNoSignInError(msg);
        setNoSignInReport(null);
        showAlert('error', 'No sign-in report', msg);
      } finally {
        setNoSignInLoading(false);
      }
    },
    [showAlert]
  );

  // Load members on mount
  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Fetch attendance when filters or page changes
  useEffect(() => {
    const filtersChanged = 
      prevFiltersRef.current.memberId !== filters.memberId ||
      prevFiltersRef.current.startDate !== filters.startDate ||
      prevFiltersRef.current.endDate !== filters.endDate ||
      prevFiltersRef.current.sortBy !== filters.sortBy ||
      prevFiltersRef.current.sortOrder !== filters.sortOrder;
    
    const sortChanged = 
      prevSortConfigRef.current?.key !== filters.sortBy ||
      prevSortConfigRef.current?.direction !== filters.sortOrder;

    // Reset to page 1 if filters or sort changed
    const targetPage = (filtersChanged || sortChanged) ? 1 : (filters.page || 1);
    const filtersToUse = { ...filters, page: targetPage };
    
    console.log('🔵 useEffect triggered - fetching attendance from API', {
      filtersChanged,
      sortChanged,
      targetPage,
      filters: filtersToUse,
      apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    });
    
    fetchAttendance(filtersToUse);
    
    prevFiltersRef.current = filters;
    prevSortConfigRef.current = filters.sortBy ? { key: filters.sortBy, direction: filters.sortOrder || 'desc' } : null;
  }, [filters, fetchAttendance]);

  useEffect(() => {
    if (activeTab !== 'no-sign-in') return;
    const days = parseInt(noSignInDays, 10);
    if (Number.isNaN(days) || days < 1) return;
    void fetchNoSignIn(days);
  }, [activeTab, noSignInDays, fetchNoSignIn]);

  const handleNoSignInDaysApply = () => {
    const days = parseInt(noSignInDays, 10);
    if (Number.isNaN(days) || days < 1 || days > 365) {
      showAlert('error', 'Invalid days', 'Enter a value between 1 and 365.');
      return;
    }
    void fetchNoSignIn(days);
  };

  // Handle filter changes
  const handleFilterChange = (key: keyof AttendanceFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1, // Reset to first page when filter changes
    }));
  };

  // Handle sorting
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (filters.sortBy === key && filters.sortOrder === 'asc') {
      direction = 'desc';
    }
    setFilters((prev) => ({
      ...prev,
      sortBy: key,
      sortOrder: direction,
      page: 1,
    }));
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  // Get status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return 'bg-green-100 text-green-800';
      case 'ABSENT':
        return 'bg-red-100 text-red-800';
      case 'LATE':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const visibleRecords = showOverdueOnly
    ? records.filter((r) => r.hasOverduePayment)
    : records;

  const showHistorySkeleton = loading && records.length === 0 && activeTab === 'history';

  return (
    <Layout>
      <Alert
        isOpen={alert.isOpen}
        onClose={closeAlert}
        type={alert.type}
        title={alert.title}
        message={alert.message}
      />
      <OverdueCheckinToasts toasts={toasts} onDismiss={dismissToast} />
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-dark-gray">Attendance</h1>
            <p className="text-sm text-gray-500 mt-1">History, absence reports, and device sync</p>
          </div>
        </div>

        <div className="border-b border-gray-200">
          <nav className="-mb-px flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`whitespace-nowrap px-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'history'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              History
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('no-sign-in')}
              className={`whitespace-nowrap px-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'no-sign-in'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              No show / Absence
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sync-users')}
              className={`whitespace-nowrap px-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'sync-users'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Sync users
            </button>
          </nav>
        </div>

        {activeTab === 'sync-users' && (
          <DeviceSyncPanel onOverdueAlerts={(alerts) => pushAlerts(alerts)} />
        )}


        {activeTab === 'no-sign-in' && (
          <>
            <div className="flex flex-col gap-4 rounded-lg bg-white p-4 shadow sm:flex-row sm:flex-wrap sm:items-end">
              <div className="w-full sm:w-auto">
                <label className="block text-sm font-medium text-dark-gray mb-1">
                  No check-in for at least (days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={noSignInDays}
                  onChange={(e) => setNoSignInDays(e.target.value)}
                  className="w-32 px-4 py-2 border rounded-lg"
                />
              </div>
              <button
                type="button"
                onClick={handleNoSignInDaysApply}
                className="w-full rounded-lg bg-primary px-4 py-2 text-white hover:bg-opacity-90 sm:w-auto"
              >
                Apply
              </button>
              {noSignInReport && noSignInReport.members.length > 0 && (
                <button
                  type="button"
                  onClick={() => exportNoSignInCsv(noSignInReport)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Export CSV
                </button>
              )}
              {noSignInReport?.cutoffDate && (
                <p className="text-sm text-gray-500">
                  Cutoff: {formatDate(noSignInReport.cutoffDate)} · {noSignInReport.total} member
                  {noSignInReport.total === 1 ? '' : 's'}
                </p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              {noSignInLoading ? (
                <div className="px-6 py-12 text-center text-gray-500">Loading report…</div>
              ) : noSignInError ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-red-600 mb-4">{noSignInError}</p>
                  <button
                    type="button"
                    onClick={handleNoSignInDaysApply}
                    className="px-4 py-2 bg-primary text-white rounded-lg"
                  >
                    Retry
                  </button>
                </div>
              ) : !noSignInReport || noSignInReport.members.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500">
                  All active members checked in within the last{' '}
                  {noSignInReport?.days ?? noSignInDays} days.
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-light-gray">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-dark-gray">Member ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-dark-gray">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-dark-gray">Phone</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-dark-gray">Last check-in</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-dark-gray">Days absent</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-dark-gray">Payment</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-dark-gray">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {noSignInReport.members.map((member) => (
                      <tr key={member.memberId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-dark-gray">
                          {displayMemberId(member)}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-dark-gray">{member.memberName}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{member.phone || '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {member.lastCheckInDate ? formatDate(member.lastCheckInDate) : 'Never'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{member.daysSinceLastSignIn}</td>
                        <td className="px-6 py-4">
                          {member.hasOverduePayment ? (
                            <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                              Overdue
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <Link
                            href={`/members?highlight=${member.memberId}`}
                            className="text-primary font-medium hover:underline"
                          >
                            View member
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {activeTab === 'history' && (
          showHistorySkeleton ? (
            <>
              <FilterBarSkeleton fields={4} />
              <TableSkeleton rows={8} columns={8} />
            </>
          ) : (
          <>
        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-dark-gray mb-1">Member</label>
              <select
                value={filters.memberId || ''}
                onChange={(e) => {
                  handleFilterChange('memberId', e.target.value ? parseInt(e.target.value) : undefined);
                }}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="">All Members</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-gray mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => {
                  handleFilterChange('startDate', e.target.value || undefined);
                }}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-gray mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => {
                  handleFilterChange('endDate', e.target.value || undefined);
                }}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setShowOverdueOnly(false);
                  setFilters({
                    memberId: undefined,
                    startDate: undefined,
                    endDate: undefined,
                    sortBy: 'date',
                    sortOrder: 'desc',
                    page: 1,
                    limit: 50,
                  });
                }}
                className="w-full bg-gray-300 text-dark-gray py-2 px-4 rounded-lg hover:bg-gray-400"
              >
                Reset
              </button>
            </div>
          </div>
          <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-dark-gray">
            <input
              type="checkbox"
              checked={showOverdueOnly}
              onChange={(e) => setShowOverdueOnly(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            Show overdue only
          </label>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-light-gray">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Date</span>
                    {filters.sortBy === 'date' && (
                      <span>{filters.sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                  Member ID
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                  onClick={() => handleSort('member')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Member</span>
                    {filters.sortBy === 'member' && (
                      <span>{filters.sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                  Contact
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                  onClick={() => handleSort('checkInTime')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Check-in</span>
                    {filters.sortBy === 'checkInTime' && (
                      <span>{filters.sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                  onClick={() => handleSort('checkOutTime')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Check-out</span>
                    {filters.sortBy === 'checkOutTime' && (
                      <span>{filters.sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {records.length === 0 && !loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center">
                    <div className="flex flex-col items-center">
                      <p className="text-gray-500 mb-2 font-semibold">
                        {apiError ? 'Failed to Load Attendance Data' : 'No attendance records found.'}
                      </p>
                      {apiError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-3 max-w-md">
                          <p className="text-sm text-red-800 font-medium mb-1">API Error:</p>
                          <p className="text-xs text-red-600">{apiError}</p>
                          <p className="text-xs text-red-500 mt-2">
                            Check browser console (F12) for more details.
                          </p>
                        </div>
                      )}
                      <p className="text-sm text-gray-400">
                        {members.length === 0 
                          ? 'Unable to connect to API. Please check if the backend server is running at http://localhost:3001'
                          : apiError 
                            ? 'Please verify your backend API is running and accessible.'
                            : 'Try adjusting your filters or check if there are any attendance records in the database.'}
                      </p>
                      {apiError && (
                        <button
                          onClick={() => {
                            setApiError(null);
                            fetchAttendance(filters);
                          }}
                          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : loading && records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    Loading attendance records from API...
                  </td>
                </tr>
              ) : visibleRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    No members with overdue payments in the current results.
                  </td>
                </tr>
              ) : (
                visibleRecords.map((record) => (
                  <tr
                    key={record.id}
                    className={
                      record.hasOverduePayment
                        ? 'border-l-4 border-l-red-500 bg-red-50/40 hover:bg-red-50/70'
                        : 'hover:bg-gray-50'
                    }
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDate(record.date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-dark-gray">{displayMemberId(record)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="text-sm font-medium text-dark-gray">{record.member}</span>
                        {record.hasOverduePayment && (
                          <button
                            type="button"
                            title={
                              record.overduePayment
                                ? overdueDetailsText(record.overduePayment)
                                : 'Member has overdue payments'
                            }
                            onClick={() =>
                              setExpandedOverdueId((prev) =>
                                prev === record.id ? null : record.id
                              )
                            }
                            className="inline-flex shrink-0 cursor-pointer rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 hover:bg-red-200"
                          >
                            Overdue
                          </button>
                        )}
                      </div>
                      {record.hasOverduePayment &&
                        expandedOverdueId === record.id &&
                        record.overduePayment && (
                          <p className="mt-1 max-w-xs whitespace-normal text-xs text-red-700">
                            {overdueDetailsText(record.overduePayment)}
                          </p>
                        )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{record.contact || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{record.checkIn || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{record.checkOut || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(record.status)}`}
                      >
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{record.durationFormatted || 'N/A'}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          
          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
                  disabled={pagination.page === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(Math.min(pagination.totalPages, pagination.page + 1))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(pagination.page * pagination.limit, pagination.total)}
                    </span>{' '}
                    of <span className="font-medium">{pagination.total}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 flex flex-wrap rounded-md shadow-sm sm:inline-flex sm:flex-nowrap sm:-space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
                      disabled={pagination.page === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      let pageNum;
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.page <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.page >= pagination.totalPages - 2) {
                        pageNum = pagination.totalPages - 4 + i;
                      } else {
                        pageNum = pagination.page - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            pagination.page === pageNum
                              ? 'z-10 bg-primary border-primary text-white'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => handlePageChange(Math.min(pagination.totalPages, pagination.page + 1))}
                      disabled={pagination.page >= pagination.totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
          </>
          )
        )}
      </div>
    </Layout>
  );
}

export default function AttendancePage() {
  return (
    <Suspense
      fallback={
        <Layout>
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-dark-gray">Attendance</h1>
              <p className="text-sm text-gray-500 mt-1">History, absence reports, and device sync</p>
            </div>
            <FilterBarSkeleton fields={4} />
            <TableSkeleton rows={8} columns={8} />
          </div>
        </Layout>
      }
    >
      <AttendancePageContent />
    </Suspense>
  );
}

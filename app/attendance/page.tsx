'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Layout from '@/components/Layout';
import Alert from '@/components/Alert';
import Loading from '@/components/Loading';
import { formatDate } from '@/lib/dateUtils';
import { useAlert } from '@/hooks/useAlert';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errorHandler';

interface Member {
  id: string;
  name: string;
}

interface AttendanceRecord {
  id: string;
  memberId: string;
  date: string;
  checkInTime: string;
  checkOutTime: string | null;
  member: {
    id: string;
    name: string;
    phone?: string | null;
  };
}

export default function AttendancePage() {
  const { alert, showAlert, closeAlert } = useAlert();
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [filters, setFilters] = useState({
    memberId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const prevFiltersRef = useRef(filters);
  const prevSortConfigRef = useRef(sortConfig);

  // Fetch attendance records
  const fetchAttendance = useCallback(async (page: number, currentFilters: typeof filters, currentSortConfig: typeof sortConfig) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (currentFilters.memberId) params.append('memberId', currentFilters.memberId);
      if (currentFilters.startDate) params.append('startDate', currentFilters.startDate);
      if (currentFilters.endDate) params.append('endDate', currentFilters.endDate);
      if (currentSortConfig?.key) params.append('sortBy', currentSortConfig.key);
      if (currentSortConfig?.direction) params.append('sortOrder', currentSortConfig.direction);
      params.append('page', page.toString());
      params.append('limit', pagination.limit.toString());

      const url = `/api/attendance?${params}`;
      console.log('Fetching attendance from:', url);
      console.log('API Base URL:', process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
      console.log('Full URL will be:', `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${url}`);
      
      const response = await api.get(url);
      console.log('Attendance API Response:', response.data);
      
      if (response.data.success) {
        const records = response.data.data?.records || [];
        console.log('Received attendance records:', records.length);
        setAllAttendance(records);
        setPagination(prev => ({
          ...prev,
          page,
          ...(response.data.data.pagination || {}),
        }));
      } else {
        console.warn('API returned success=false:', response.data);
        setAllAttendance([]);
      }
    } catch (error: any) {
      console.error('Error fetching attendance:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
      });
      showAlert('error', 'Error Loading Attendance', getErrorMessage(error));
      setAllAttendance([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, showAlert]);

  // Fetch members for filter dropdown
  const fetchMembers = useCallback(async () => {
    try {
      const membersUrl = '/api/members?limit=1000';
      console.log('Fetching members from:', membersUrl);
      console.log('Full URL will be:', `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${membersUrl}`);
      const response = await api.get(membersUrl);
      console.log('Members API Response:', response.data);
      if (response.data.success) {
        const membersList = response.data.data?.members || [];
        console.log('Received members:', membersList.length);
        setMembers(membersList);
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

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Fetch attendance when filters, sort, or page changes
  useEffect(() => {
    const filtersChanged = 
      prevFiltersRef.current.memberId !== filters.memberId ||
      prevFiltersRef.current.startDate !== filters.startDate ||
      prevFiltersRef.current.endDate !== filters.endDate;
    const sortChanged = 
      prevSortConfigRef.current?.key !== sortConfig?.key ||
      prevSortConfigRef.current?.direction !== sortConfig?.direction;

    const targetPage = (filtersChanged || sortChanged) ? 1 : pagination.page;
    
    fetchAttendance(targetPage, filters, sortConfig);
    
    prevFiltersRef.current = filters;
    prevSortConfigRef.current = sortConfig;
  }, [filters, sortConfig, pagination.page, fetchAttendance]);

  // Handle sorting
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filter and sort attendance (client-side filtering for date range if needed)
  const attendance = useMemo(() => {
    let filtered = allAttendance;

    // Apply client-side date filtering if API doesn't handle it properly
    filtered = filtered.filter(record => {
      const recordDate = new Date(record.date).toISOString().split('T')[0];
      if (filters.startDate && recordDate < filters.startDate) return false;
      if (filters.endDate && recordDate > filters.endDate) return false;
      return true;
    });

    // Apply client-side sorting if needed (API should handle this, but fallback)
    if (sortConfig && !sortConfig.key.includes('date') && !sortConfig.key.includes('member')) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case 'phone':
            aValue = a.member.phone?.toLowerCase() || '';
            bValue = b.member.phone?.toLowerCase() || '';
            break;
          case 'checkInTime':
            aValue = a.checkInTime || '';
            bValue = b.checkInTime || '';
            break;
          case 'checkOutTime':
            aValue = a.checkOutTime || '';
            bValue = b.checkOutTime || '';
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [allAttendance, filters, sortConfig]);


  const getStatusFromRecord = (record: AttendanceRecord): { text: string; color: string } => {
    if (record.checkOutTime) {
      return { text: 'Checked Out', color: 'bg-green-100 text-green-800' };
    } else if (record.checkInTime) {
      return { text: 'Checked In', color: 'bg-blue-100 text-blue-800' };
    }
    return { text: 'Unknown', color: 'bg-gray-100 text-gray-800' };
  };

  if (loading) {
    return (
      <Layout>
        <Loading message="Loading attendance..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <Alert
        isOpen={alert.isOpen}
        onClose={closeAlert}
        type={alert.type}
        title={alert.title}
        message={alert.message}
      />
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-dark-gray">Attendance</h1>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-gray mb-1">Member</label>
              <select
                value={filters.memberId}
                onChange={(e) => {
                  setFilters({ ...filters, memberId: e.target.value });
                }}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="">All Members</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-gray mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => {
                  setFilters({ ...filters, startDate: e.target.value });
                }}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-gray mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => {
                  setFilters({ ...filters, endDate: e.target.value });
                }}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({
                    memberId: '',
                    startDate: new Date().toISOString().split('T')[0],
                    endDate: new Date().toISOString().split('T')[0],
                  });
                  setPagination({ ...pagination, page: 1 });
                }}
                className="w-full bg-gray-300 text-dark-gray py-2 px-4 rounded-lg hover:bg-gray-400"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

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
                    {sortConfig?.key === 'date' && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                  onClick={() => handleSort('member')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Member</span>
                    {sortConfig?.key === 'member' && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                  onClick={() => handleSort('phone')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Contact</span>
                    {sortConfig?.key === 'phone' && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                  onClick={() => handleSort('checkInTime')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Check In</span>
                    {sortConfig?.key === 'checkInTime' && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                  onClick={() => handleSort('checkOutTime')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Check Out</span>
                    {sortConfig?.key === 'checkOutTime' && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {attendance.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center">
                    <div className="flex flex-col items-center">
                      <p className="text-gray-500 mb-2">No attendance records found.</p>
                      <p className="text-sm text-gray-400">
                        {members.length === 0 
                          ? 'Unable to connect to API. Please check if the backend server is running at http://localhost:3001'
                          : 'Try adjusting your filters or check if there are any attendance records in the database.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Loading attendance records...
                  </td>
                </tr>
              ) : (
                attendance.map((record) => {
                  const status = getStatusFromRecord(record);
                  return (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(record.date)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-dark-gray">{record.member.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{record.member.phone || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{record.checkInTime || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{record.checkOutTime || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status.color}`}
                        >
                          {status.text}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {pagination.totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setPagination({ ...pagination, page: Math.max(1, pagination.page - 1) })}
                  disabled={pagination.page === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination({ ...pagination, page: Math.min(pagination.totalPages, pagination.page + 1) })}
                  disabled={pagination.page === pagination.totalPages}
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
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setPagination({ ...pagination, page: Math.max(1, pagination.page - 1) })}
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
                          onClick={() => setPagination({ ...pagination, page: pageNum })}
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
                      onClick={() => setPagination({ ...pagination, page: Math.min(pagination.totalPages, pagination.page + 1) })}
                      disabled={pagination.page === pagination.totalPages}
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
      </div>
    </Layout>
  );
}


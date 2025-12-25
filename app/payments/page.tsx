'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Layout from '@/components/Layout';
import Alert from '@/components/Alert';
import Loading from '@/components/Loading';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/dateUtils';
import { useAlert } from '@/hooks/useAlert';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errorHandler';

interface Member {
  id: string;
  name: string;
}

interface Payment {
  id: string;
  memberId: string;
  month: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  dueDate: string;
  paidDate: string | null;
  member: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const { alert, showAlert, closeAlert } = useAlert();
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; paymentId: string | null; payment: Payment | null }>({
    isOpen: false,
    paymentId: null,
    payment: null,
  });
  const [filters, setFilters] = useState({
    memberId: '',
    status: '',
    month: '',
  });

  // Fetch payments from API
  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔵 Fetching payments from API...');
      const params = new URLSearchParams();
      
      if (filters.memberId) params.append('memberId', filters.memberId);
      if (filters.status) params.append('status', filters.status);
      if (filters.month) params.append('month', filters.month);
      if (searchQuery) params.append('search', searchQuery);
      if (sortConfig?.key) params.append('sortBy', sortConfig.key);
      if (sortConfig?.direction) params.append('sortOrder', sortConfig.direction);
      params.append('limit', '1000');

      const response = await api.get(`/api/payments?${params}`);
      console.log('Payments API Response:', response.data);

      if (response.data.success) {
        const paymentsList = response.data.data.payments || [];
        setAllPayments(paymentsList);
        console.log('✅ Payments loaded:', paymentsList.length);
      }
    } catch (error: any) {
      console.error('Error fetching payments:', error);
      showAlert('error', 'Error', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [filters, searchQuery, sortConfig, showAlert]);

  // Fetch members for filter dropdown
  const fetchMembers = useCallback(async () => {
    try {
      console.log('🔵 Fetching members for payments filter...');
      const response = await api.get('/api/members?limit=1000');
      console.log('Members API Response:', response.data);

      if (response.data.success) {
        const membersList = response.data.data.members || [];
        setMembers(membersList);
        console.log('✅ Members loaded:', membersList.length);
      }
    } catch (error: any) {
      console.error('Error fetching members:', error);
      // Don't show alert for members, just log
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Fetch payments when filters, search, or sort changes
  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Initialize filters from URL query parameters
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setFilters(prev => ({ ...prev, status: statusParam }));
    }
  }, [searchParams]);

  // Handle sorting
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filter and sort payments
  const payments = useMemo(() => {
    let filtered = allPayments.filter(payment => {
      if (filters.memberId && payment.memberId !== filters.memberId) return false;
      if (filters.status && payment.status !== filters.status) return false;
      if (filters.month && payment.month !== filters.month) return false;
      return true;
    });

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(payment => {
        const memberName = payment.member.name?.toLowerCase() || '';
        const memberPhone = payment.member.phone?.toLowerCase() || '';
        const memberEmail = payment.member.email?.toLowerCase() || '';
        const amount = payment.amount.toString();
        const month = payment.month.toLowerCase();
        const status = payment.status.toLowerCase();
        const paymentId = payment.id.toLowerCase();
        
        return (
          memberName.includes(query) ||
          memberPhone.includes(query) ||
          memberEmail.includes(query) ||
          amount.includes(query) ||
          month.includes(query) ||
          status.includes(query) ||
          paymentId.includes(query)
        );
      });
    }

    // Apply sorting
    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case 'month':
            aValue = a.month;
            bValue = b.month;
            break;
          case 'member':
            aValue = a.member.name?.toLowerCase() || '';
            bValue = b.member.name?.toLowerCase() || '';
            break;
          case 'amount':
            aValue = a.amount;
            bValue = b.amount;
            break;
          case 'dueDate':
            aValue = new Date(a.dueDate).getTime();
            bValue = new Date(b.dueDate).getTime();
            break;
          case 'status':
            aValue = a.status.toLowerCase();
            bValue = b.status.toLowerCase();
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
  }, [allPayments, filters, searchQuery, sortConfig]);


  const handleMarkPaid = async (id: string) => {
    try {
      setLoading(true);
      console.log('🔵 Marking payment as paid:', id);
      const response = await api.patch(`/api/payments/${id}/mark-paid`);
      console.log('Mark paid response:', response.data);
      
      if (response.data.success) {
        showAlert('success', 'Payment Recorded', `Payment has been marked as paid successfully.`);
        await fetchPayments(); // Refresh list
      }
    } catch (error: any) {
      console.error('Error marking payment as paid:', error);
      showAlert('error', 'Error', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaidClick = (payment: Payment) => {
    setConfirmDialog({
      isOpen: true,
      paymentId: payment.id,
      payment: payment,
    });
  };

  const handleConfirmMarkPaid = () => {
    if (confirmDialog.paymentId) {
      handleMarkPaid(confirmDialog.paymentId);
    }
    setConfirmDialog({ isOpen: false, paymentId: null, payment: null });
  };

  const handlePrintReceipt = async (payment: Payment) => {
    if (payment.status !== 'PAID') {
      showAlert('warning', 'Cannot Print Receipt', 'Receipt can only be printed for paid payments.');
      return;
    }

    try {
      console.log('🔵 Fetching receipt data for payment:', payment.id);
      const response = await api.get(`/api/payments/${payment.id}/receipt`);
      console.log('Receipt API Response:', response.data);
      
      if (response.data.success) {
        const receiptData = response.data.data;
        // Use receipt data from API for printing
        payment = receiptData.payment || payment;
      }
    } catch (error: any) {
      console.error('Error fetching receipt:', error);
      // Continue with existing payment data if API fails
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Receipt - ${payment.member.name}</title>
          <style>
            @media print {
              @page { margin: 20mm; }
            }
            body {
              font-family: Arial, sans-serif;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              text-align: center;
              border-bottom: 3px solid #333;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              margin: 0;
              color: #333;
              font-size: 28px;
            }
            .header p {
              margin: 5px 0;
              color: #666;
            }
            .receipt-info {
              margin-bottom: 30px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #eee;
            }
            .info-label {
              font-weight: bold;
              color: #333;
            }
            .info-value {
              color: #666;
            }
            .amount-section {
              background: #f5f5f5;
              padding: 20px;
              border-radius: 8px;
              margin: 30px 0;
            }
            .amount-row {
              display: flex;
              justify-content: space-between;
              font-size: 18px;
              margin: 10px 0;
            }
            .total {
              font-size: 24px;
              font-weight: bold;
              color: #333;
              border-top: 2px solid #333;
              padding-top: 10px;
              margin-top: 10px;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              color: #666;
              font-size: 12px;
              border-top: 1px solid #eee;
              padding-top: 20px;
            }
            .status-badge {
              display: inline-block;
              padding: 5px 15px;
              background: #10b981;
              color: white;
              border-radius: 20px;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>FitNixTrack Gym</h1>
            <p>Payment Receipt</p>
          </div>
          
          <div class="receipt-info">
            <div class="info-row">
              <span class="info-label">Receipt Number:</span>
              <span class="info-value">#${payment.id}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Date:</span>
              <span class="info-value">${formatDate(payment.paidDate)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Member Name:</span>
              <span class="info-value">${payment.member.name}</span>
            </div>
            ${payment.member.phone ? `
            <div class="info-row">
              <span class="info-label">Phone:</span>
              <span class="info-value">${payment.member.phone}</span>
            </div>
            ` : ''}
            <div class="info-row">
              <span class="info-label">Payment Month:</span>
              <span class="info-value">${payment.month}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span class="info-value"><span class="status-badge">PAID</span></span>
            </div>
          </div>
          
          <div class="amount-section">
            <div class="amount-row">
              <span>Amount:</span>
              <span>Rs. ${payment.amount.toFixed(2)}</span>
            </div>
            <div class="amount-row total">
              <span>Total Paid:</span>
              <span>Rs. ${payment.amount.toFixed(2)}</span>
            </div>
          </div>
          
          <div class="footer">
            <p>Thank you for your payment!</p>
            <p>This is a computer-generated receipt.</p>
            <p>Generated on: ${formatDate(new Date().toISOString())}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleCheckOverdue = async () => {
    try {
      setLoading(true);
      console.log('🔵 Checking for overdue payments...');
      const response = await api.post('/api/payments/generate-overdue');
      console.log('Generate overdue response:', response.data);
      
      if (response.data.success) {
        const updatedCount = response.data.data.updated || 0;
        if (updatedCount > 0) {
          showAlert('success', 'Overdue Payments Updated', `${updatedCount} payment(s) marked as overdue.`);
        } else {
          showAlert('info', 'All Payments Up to Date', 'No overdue payments found. All payments are current.');
        }
        await fetchPayments(); // Refresh list
      }
    } catch (error: any) {
      console.error('Error checking overdue payments:', error);
      showAlert('error', 'Error', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'OVERDUE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Layout>
        <Loading message="Loading payments..." />
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
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, paymentId: null, payment: null })}
        onConfirm={handleConfirmMarkPaid}
        title="Mark Payment as Paid"
        message={confirmDialog.payment ? `Are you sure you want to mark the payment of Rs. ${confirmDialog.payment.amount.toFixed(2)} for ${confirmDialog.payment.member.name} as PAID?` : ''}
        confirmText="Mark as Paid"
        cancelText="Cancel"
        type="warning"
      />
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
          <h1 className="text-3xl font-bold text-dark-gray">Payments</h1>
            <p className="text-sm text-gray-500 mt-1">Payment records are automatically created when members join</p>
          </div>
          <div className="flex gap-2">
            {user?.role === 'GYM_ADMIN' && (
                <button
                  onClick={handleCheckOverdue}
                  className="bg-orange text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-colors"
                >
                  Check Overdue
                </button>
            )}
          </div>
        </div>

        {/* Search/Filter */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search payments by member name, phone, email, amount, month, or status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <svg
                  className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Clear
                </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-gray mb-1">Member</label>
              <select
                value={filters.memberId}
                onChange={(e) => setFilters({ ...filters, memberId: e.target.value })}
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
              <label className="block text-sm font-medium text-dark-gray mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-gray mb-1">Month</label>
              <input
                type="month"
                value={filters.month}
                onChange={(e) => setFilters({ ...filters, month: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({ memberId: '', status: '', month: '' });
                  setSearchQuery('');
                }}
                className="w-full bg-gray-300 text-dark-gray py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Reset All
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
                  onClick={() => handleSort('month')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Month</span>
                    {sortConfig?.key === 'month' && (
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
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Amount</span>
                    {sortConfig?.key === 'amount' && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                  onClick={() => handleSort('dueDate')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Due Date</span>
                    {sortConfig?.key === 'dueDate' && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Status</span>
                    {sortConfig?.key === 'status' && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                {user?.role === 'GYM_ADMIN' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={user?.role === 'GYM_ADMIN' ? 6 : 5} className="px-6 py-8 text-center text-gray-500">
                    {searchQuery || filters.memberId || filters.status || filters.month
                      ? 'No payments found matching your search or filters.'
                      : 'No payments found.'}
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{payment.month}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-dark-gray">{payment.member.name}</div>
                    <div className="text-sm text-gray-500">{payment.member.phone || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">Rs. {payment.amount.toFixed(2)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {formatDate(payment.dueDate)}
                    </div>
                    {payment.paidDate && (
                      <div className="text-xs text-gray-400">
                        Paid: {formatDate(payment.paidDate)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                        payment.status
                      )}`}
                    >
                      {payment.status}
                    </span>
                  </td>
                  {user?.role === 'GYM_ADMIN' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {payment.status !== 'PAID' ? (
                        <button
                          onClick={() => handleMarkPaidClick(payment)}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                          Mark as Paid
                        </button>
                      ) : (
                      <button
                          onClick={() => handlePrintReceipt(payment)}
                          className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-900 p-2.5 rounded-lg transition-colors font-medium flex items-center justify-center shadow-sm"
                          title="Print Receipt"
                      >
                          <svg className="w-5 h-5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                      </button>
                      )}
                    </td>
                  )}
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}


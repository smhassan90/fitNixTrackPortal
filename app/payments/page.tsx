'use client';

import { useState, useMemo } from 'react';
import Layout from '@/components/Layout';
import { mockPayments, mockMembers } from '@/lib/mockData';
import { useAuth } from '@/contexts/AuthContext';

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
  const [allPayments, setAllPayments] = useState<Payment[]>(mockPayments);
  const [members] = useState<Member[]>(mockMembers);
  const [loading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({
    memberId: '',
    status: '',
    month: '',
  });
  const [formData, setFormData] = useState({
    memberId: '',
    month: new Date().toISOString().slice(0, 7),
    amount: '',
    dueDate: '',
  });

  // Filter payments based on filters
  const payments = useMemo(() => {
    return allPayments.filter(payment => {
      if (filters.memberId && payment.memberId !== filters.memberId) return false;
      if (filters.status && payment.status !== filters.status) return false;
      if (filters.month && payment.month !== filters.month) return false;
      return true;
    });
  }, [allPayments, filters]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const member = members.find(m => m.id === formData.memberId);
    if (!member) {
      alert('Please select a member');
      return;
    }
    
    const newPayment: Payment = {
      id: Date.now().toString(),
      memberId: formData.memberId,
      month: formData.month,
      amount: parseFloat(formData.amount),
      status: 'PENDING',
      dueDate: new Date(formData.dueDate).toISOString(),
      paidDate: null,
      member: {
        id: member.id,
        name: member.name,
        phone: null,
        email: null,
      },
    };
    
    setAllPayments([...allPayments, newPayment]);
    setShowModal(false);
    resetForm();
  };

  const handleMarkPaid = async (id: string) => {
    setAllPayments(allPayments.map(p => 
      p.id === id 
        ? { ...p, status: 'PAID' as const, paidDate: new Date().toISOString() }
        : p
    ));
  };

  const handleCheckOverdue = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    setAllPayments(allPayments.map(p => {
      const dueDate = new Date(p.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      
      if (p.status === 'PENDING' && dueDate < today) {
        return { ...p, status: 'OVERDUE' as const };
      }
      return p;
    }));
    
    alert('Overdue payments checked and updated');
  };

  const resetForm = () => {
    setFormData({
      memberId: '',
      month: new Date().toISOString().slice(0, 7),
      amount: '',
      dueDate: '',
    });
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
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
        <div className="text-center py-12">Loading payments...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-dark-gray">Payments</h1>
          <div className="flex gap-2">
            {user?.role === 'GYM_ADMIN' && (
              <>
                <button
                  onClick={handleCheckOverdue}
                  className="bg-orange text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-colors"
                >
                  Check Overdue
                </button>
                <button
                  onClick={openAddModal}
                  className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-colors"
                >
                  + Add Payment
                </button>
              </>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                  Month
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                  Status
                </th>
                {user?.role === 'GYM_ADMIN' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{payment.month}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-dark-gray">{payment.member.name}</div>
                    <div className="text-sm text-gray-500">{payment.member.phone || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">${payment.amount.toFixed(2)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(payment.dueDate).toLocaleDateString()}
                    </div>
                    {payment.paidDate && (
                      <div className="text-xs text-gray-400">
                        Paid: {new Date(payment.paidDate).toLocaleDateString()}
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
                  {user?.role === 'GYM_ADMIN' && payment.status !== 'PAID' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleMarkPaid(payment.id)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Mark Paid
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-2xl font-bold text-dark-gray mb-4">Add Payment</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-1">Member</label>
                  <select
                    required
                    value={formData.memberId}
                    onChange={(e) => setFormData({ ...formData, memberId: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    <option value="">Select Member</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-1">Month</label>
                  <input
                    type="month"
                    required
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="50.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-primary text-white py-2 px-4 rounded-lg hover:bg-opacity-90"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="flex-1 bg-gray-300 text-dark-gray py-2 px-4 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}


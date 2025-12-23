'use client';

import React, { useState, useMemo } from 'react';
import Layout from '@/components/Layout';
import Alert from '@/components/Alert';
import { mockMembers, mockTrainers, mockPackages } from '@/lib/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/dateUtils';
import { useAlert } from '@/hooks/useAlert';
import { useRouter } from 'next/navigation';

interface Trainer {
  id: string;
  name: string;
  specialization: string | null;
  charges?: number;
}

interface Package {
  id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
}

interface Member {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  cnic: string | null;
  comments: string | null;
  packageId: string | null;
  discount?: number;
  trainers: Trainer[];
}

export default function MembersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { alert, showAlert, closeAlert } = useAlert();
  const [members, setMembers] = useState<Member[]>(mockMembers.map(m => ({
    ...m,
    gender: null,
    dateOfBirth: null,
    cnic: null,
    comments: null,
    packageId: null,
  })));
  const [trainers] = useState<Trainer[]>(mockTrainers);
  const [availablePackages] = useState<Package[]>(mockPackages);
  const [loading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    gender: '',
    dateOfBirth: '',
    cnic: '',
    comments: '',
    packageId: '',
    requiresTrainer: false,
    trainerId: '',
    discount: '',
  });

  // Handle sorting
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filter and sort members
  const filteredMembers = useMemo(() => {
    let filtered = members;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(member =>
        member.name.toLowerCase().includes(query) ||
        member.phone?.toLowerCase().includes(query) ||
        member.email?.toLowerCase().includes(query) ||
        member.cnic?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case 'name':
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case 'phone':
            aValue = a.phone?.toLowerCase() || '';
            bValue = b.phone?.toLowerCase() || '';
            break;
          case 'email':
            aValue = a.email?.toLowerCase() || '';
            bValue = b.email?.toLowerCase() || '';
            break;
          case 'gender':
            aValue = a.gender?.toLowerCase() || '';
            bValue = b.gender?.toLowerCase() || '';
            break;
          case 'dateOfBirth':
            aValue = a.dateOfBirth ? new Date(a.dateOfBirth).getTime() : 0;
            bValue = b.dateOfBirth ? new Date(b.dateOfBirth).getTime() : 0;
            break;
          case 'cnic':
            aValue = a.cnic?.toLowerCase() || '';
            bValue = b.cnic?.toLowerCase() || '';
            break;
          case 'package':
            const aPkg = availablePackages.find(p => p.id === a.packageId);
            const bPkg = availablePackages.find(p => p.id === b.packageId);
            aValue = aPkg?.name?.toLowerCase() || '';
            bValue = bPkg?.name?.toLowerCase() || '';
            break;
          case 'monthlyPayment':
            const aPkg2 = availablePackages.find(p => p.id === a.packageId);
            const aTrainer = a.trainers.length > 0 ? trainers.find(t => t.id === a.trainers[0].id) : null;
            let aTotal = 0;
            if (aPkg2) {
              aTotal += aPkg2.duration.includes('12') ? aPkg2.price / 12 : aPkg2.price;
            }
            if (aTrainer?.charges) aTotal += aTrainer.charges;
            if (a.discount) aTotal = Math.max(0, aTotal - a.discount);
            
            const bPkg2 = availablePackages.find(p => p.id === b.packageId);
            const bTrainer = b.trainers.length > 0 ? trainers.find(t => t.id === b.trainers[0].id) : null;
            let bTotal = 0;
            if (bPkg2) {
              bTotal += bPkg2.duration.includes('12') ? bPkg2.price / 12 : bPkg2.price;
            }
            if (bTrainer?.charges) bTotal += bTrainer.charges;
            if (b.discount) bTotal = Math.max(0, bTotal - b.discount);
            
            aValue = aTotal;
            bValue = bTotal;
            break;
          case 'trainer':
            const aTrainer2 = a.trainers.length > 0 ? trainers.find(t => t.id === a.trainers[0].id) : null;
            const bTrainer2 = b.trainers.length > 0 ? trainers.find(t => t.id === b.trainers[0].id) : null;
            aValue = aTrainer2?.name?.toLowerCase() || '';
            bValue = bTrainer2?.name?.toLowerCase() || '';
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
  }, [members, searchQuery, sortConfig, availablePackages, trainers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMember) {
        // Update existing member
        setMembers(members.map(m => 
          m.id === editingMember.id 
            ? { 
                ...m, 
                name: formData.name,
                phone: formData.phone || null,
                email: formData.email || null,
                gender: formData.gender || null,
                dateOfBirth: formData.dateOfBirth || null,
                cnic: formData.cnic || null,
                comments: formData.comments || null,
                packageId: formData.packageId || null,
                discount: formData.discount ? parseFloat(formData.discount) : undefined,
                trainers: formData.requiresTrainer && formData.trainerId
                  ? trainers.filter(t => t.id === formData.trainerId)
                  : []
              }
            : m
        ));
        setEditingMember(null);
      } else {
        // Add new member
        const newMember: Member = {
          id: Date.now().toString(),
          name: formData.name,
          phone: formData.phone || null,
          email: formData.email || null,
          gender: formData.gender || null,
          dateOfBirth: formData.dateOfBirth || null,
          cnic: formData.cnic || null,
          comments: formData.comments || null,
          packageId: formData.packageId || null,
          discount: formData.discount ? parseFloat(formData.discount) : undefined,
          trainers: formData.requiresTrainer && formData.trainerId
            ? trainers.filter(t => t.id === formData.trainerId)
            : [],
        };
        setMembers([...members, newMember]);
        setShowAddForm(false);

        // Automatically create payment record for new member
        if (formData.packageId) {
          const selectedPackage = availablePackages.find(p => p.id === formData.packageId);
          const selectedTrainer = formData.requiresTrainer && formData.trainerId
            ? trainers.find(t => t.id === formData.trainerId)
            : null;

          // Calculate monthly payment
          let monthlyAmount = 0;
          if (selectedPackage) {
            monthlyAmount += selectedPackage.duration.includes('12')
              ? selectedPackage.price / 12
              : selectedPackage.price;
          }
          if (selectedTrainer?.charges) {
            monthlyAmount += selectedTrainer.charges;
          }
          if (formData.discount) {
            monthlyAmount = Math.max(0, monthlyAmount - parseFloat(formData.discount));
          }

          // Create payment record
          const today = new Date();
          const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
          const dueDate = new Date(nextMonth);
          
          const newPayment = {
            id: `payment-${Date.now()}`,
            memberId: newMember.id,
            month: nextMonth.toISOString().slice(0, 7), // YYYY-MM format
            amount: monthlyAmount,
            status: 'PENDING' as const,
            dueDate: dueDate.toISOString(),
            paidDate: null,
            member: {
              id: newMember.id,
              name: newMember.name,
              phone: newMember.phone,
              email: newMember.email,
            },
          };

          // Save payment to localStorage
          if (typeof window !== 'undefined') {
            const existingPayments = localStorage.getItem('payments');
            const payments = existingPayments ? JSON.parse(existingPayments) : [];
            payments.push(newPayment);
            localStorage.setItem('payments', JSON.stringify(payments));
          }
        }
      }
      resetForm();
      showAlert('success', 'Member Saved', editingMember ? 'Member updated successfully!' : 'Member added successfully!');
    } catch (error: any) {
      showAlert('error', 'Error', 'Failed to save member. Please try again.');
    }
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    setShowAddForm(false);
    setFormData({
      name: member.name,
      phone: member.phone || '',
      email: member.email || '',
      gender: member.gender || '',
      dateOfBirth: member.dateOfBirth ? member.dateOfBirth.split('T')[0] : '',
      cnic: member.cnic || '',
      comments: member.comments || '',
      packageId: member.packageId || '',
      requiresTrainer: member.trainers.length > 0,
      trainerId: member.trainers.length > 0 ? member.trainers[0].id : '',
      discount: member.discount?.toString() || '',
    });
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setEditingMember(null);
    setShowAddForm(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this member?')) return;
    setMembers(members.filter(m => m.id !== id));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      gender: '',
      dateOfBirth: '',
      cnic: '',
      comments: '',
      packageId: '',
      requiresTrainer: false,
      trainerId: '',
      discount: '',
    });
  };

  const handleCNICChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove all non-numeric characters
    let value = e.target.value.replace(/\D/g, '');
    
    // Limit to 13 digits
    if (value.length > 13) {
      value = value.slice(0, 13);
    }
    
    // Format as XXXXX-XXXXXXX-X
    let formatted = value;
    if (value.length > 5) {
      formatted = value.slice(0, 5) + '-' + value.slice(5);
    }
    if (value.length > 12) {
      formatted = value.slice(0, 5) + '-' + value.slice(5, 12) + '-' + value.slice(12);
    }
    
    setFormData({ ...formData, cnic: formatted });
  };

  const selectedTrainer = trainers.find(t => t.id === formData.trainerId);
  const selectedPackage = availablePackages.find(p => p.id === formData.packageId);

  // Calculate monthly payment
  const monthlyPayment = useMemo(() => {
    let total = 0;
    
    // Package price (convert annual to monthly if needed)
    if (selectedPackage) {
      if (selectedPackage.duration.includes('12')) {
        total += selectedPackage.price / 12; // Annual package divided by 12
      } else {
        total += selectedPackage.price;
      }
    }
    
    // Trainer charges
    if (selectedTrainer && selectedTrainer.charges) {
      total += selectedTrainer.charges;
    }
    
    // Apply discount
    const discountAmount = parseFloat(formData.discount || '0');
    total = Math.max(0, total - discountAmount);
    
    return total;
  }, [selectedPackage, selectedTrainer, formData.discount]);

  const openAddForm = () => {
    setEditingMember(null);
    resetForm();
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Loading members...</div>
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
            <h1 className="text-3xl font-bold text-dark-gray">Members</h1>
            {user?.role === 'GYM_ADMIN' && !showAddForm && !editingMember && (
              <button
                onClick={openAddForm}
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-colors"
              >
                + Add Member
              </button>
            )}
          </div>

          {/* Search/Filter */}
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search members by name, phone, or email..."
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
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Add/Edit Form */}
          {(showAddForm || editingMember) && (
            <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-dark-gray">
                {editingMember ? 'Edit Member' : 'Add New Member'}
              </h2>
              <button
                onClick={handleCancel}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.name.length}/100 characters
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-1">Phone</label>
                  <input
                    type="tel"
                    maxLength={20}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="+923001234567"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.phone.length}/20 characters
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-1">Email</label>
                  <input
                    type="email"
                    maxLength={255}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.email.length}/255 characters
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-1">CNIC</label>
                  <input
                    type="text"
                    placeholder="XXXXX-XXXXXXX-X"
                    value={formData.cnic}
                    onChange={handleCNICChange}
                    maxLength={15}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  {formData.cnic && formData.cnic.replace(/\D/g, '').length < 13 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {13 - formData.cnic.replace(/\D/g, '').length} digits remaining
                    </p>
                  )}
                  {formData.cnic && formData.cnic.replace(/\D/g, '').length === 13 && (
                    <p className="text-xs text-green-600 mt-1 flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Valid CNIC format
                    </p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-dark-gray mb-1">Select Package *</label>
                  <select
                    required
                    value={formData.packageId}
                    onChange={(e) => setFormData({ ...formData, packageId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Select a package</option>
                    {availablePackages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} - Rs. {pkg.price.toLocaleString()} ({pkg.duration})
                      </option>
                    ))}
                  </select>
                  {selectedPackage && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs font-medium text-gray-700 mb-1">Package Features:</p>
                      <ul className="text-xs text-gray-600 space-y-1">
                        {selectedPackage.features.map((feature, idx) => (
                          <li key={idx} className="flex items-center">
                            <span className="mr-2">✓</span>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <div className="flex items-center space-x-3 mb-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.requiresTrainer}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            requiresTrainer: e.target.checked,
                            trainerId: e.target.checked ? formData.trainerId : '',
                          });
                        }}
                        className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <span className="text-sm font-medium text-dark-gray">Do you require a trainer?</span>
                    </label>
                  </div>
                  
                  {formData.requiresTrainer && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-dark-gray mb-1">Select Trainer *</label>
                        <select
                          required={formData.requiresTrainer}
                          value={formData.trainerId}
                          onChange={(e) => setFormData({ ...formData, trainerId: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                          <option value="">Select a trainer</option>
                          {trainers.map((trainer) => (
                            <option key={trainer.id} value={trainer.id}>
                              {trainer.name} {trainer.specialization ? `- ${trainer.specialization}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {selectedTrainer && selectedTrainer.charges && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium text-blue-900">Trainer Charges</p>
                              <p className="text-xs text-blue-700 mt-1">
                                {selectedTrainer.name} - {selectedTrainer.specialization || 'General Training'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-blue-900">
                                Rs. {selectedTrainer.charges.toLocaleString()}
                              </p>
                              <p className="text-xs text-blue-700">per month</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Discount Field */}
                {selectedPackage && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-dark-gray mb-1">
                      Discount (Rs.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="999999"
                      step="100"
                      value={formData.discount}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 999999)) {
                          setFormData({ ...formData, discount: value });
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="e.g., 200"
                    />
                    {formData.discount && parseFloat(formData.discount) > 0 && (
                      <p className="text-xs text-green-600 mt-1">
                        Discount of Rs. {parseFloat(formData.discount).toLocaleString()} will be applied
                      </p>
                    )}
                  </div>
                )}
                
                {/* Monthly Payment Summary */}
                {selectedPackage && (
                  <div className="md:col-span-2">
                    <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-5 text-white">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-white opacity-90 mb-2">Monthly Payment</p>
                          <div className="space-y-1 text-xs text-white opacity-80">
                            {selectedPackage && (
                              <div className="flex justify-between">
                                <span>Package ({selectedPackage.name}):</span>
                                <span>
                                  Rs. {selectedPackage.duration.includes('12') 
                                    ? (selectedPackage.price / 12).toLocaleString('en-US', { maximumFractionDigits: 0 })
                                    : selectedPackage.price.toLocaleString()}
                                </span>
                              </div>
                            )}
                            {selectedTrainer && selectedTrainer.charges && (
                              <div className="flex justify-between">
                                <span>Trainer ({selectedTrainer.name}):</span>
                                <span>Rs. {selectedTrainer.charges.toLocaleString()}</span>
                              </div>
                            )}
                            {formData.discount && parseFloat(formData.discount) > 0 && (
                              <div className="flex justify-between text-green-200">
                                <span>Discount:</span>
                                <span>- Rs. {parseFloat(formData.discount).toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right border-l border-white border-opacity-30 pl-5">
                          <p className="text-xs text-white opacity-80 mb-1">Total Monthly</p>
                          <p className="text-3xl font-bold">
                            Rs. {monthlyPayment.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-dark-gray mb-1">Comments</label>
                  <textarea
                    value={formData.comments}
                    onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                    rows={4}
                    maxLength={1000}
                    placeholder="Add any additional comments or notes about this member..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.comments.length}/1000 characters
                  </p>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="bg-primary text-white py-2 px-6 rounded-lg hover:bg-opacity-90 transition-colors font-medium"
                >
                  {editingMember ? 'Update Member' : 'Add Member'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="bg-gray-300 text-dark-gray py-2 px-6 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
            </div>
          )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-light-gray">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Name</span>
                      {sortConfig?.key === 'name' && (
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
                    onClick={() => handleSort('gender')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Gender</span>
                      {sortConfig?.key === 'gender' && (
                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() => handleSort('dateOfBirth')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Date of Birth</span>
                      {sortConfig?.key === 'dateOfBirth' && (
                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() => handleSort('cnic')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>CNIC</span>
                      {sortConfig?.key === 'cnic' && (
                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() => handleSort('package')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Package</span>
                      {sortConfig?.key === 'package' && (
                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() => handleSort('monthlyPayment')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Monthly Payment</span>
                      {sortConfig?.key === 'monthlyPayment' && (
                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                    onClick={() => handleSort('trainer')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Trainer</span>
                      {sortConfig?.key === 'trainer' && (
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
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={user?.role === 'GYM_ADMIN' ? 9 : 8} className="px-6 py-8 text-center text-gray-500">
                    {searchQuery ? 'No members found matching your search.' : 'No members found.'}
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const memberPackage = availablePackages.find(p => p.id === member.packageId);
                  const memberTrainer = member.trainers.length > 0 ? trainers.find(t => t.id === member.trainers[0].id) : null;
                  
                  // Calculate monthly payment for display
                  let monthlyTotal = 0;
                  if (memberPackage) {
                    monthlyTotal += memberPackage.duration.includes('12') 
                      ? memberPackage.price / 12 
                      : memberPackage.price;
                  }
                  if (memberTrainer && memberTrainer.charges) {
                    monthlyTotal += memberTrainer.charges;
                  }
                  // Apply discount
                  if (member.discount) {
                    monthlyTotal = Math.max(0, monthlyTotal - member.discount);
                  }
                  
                  return (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-dark-gray">{member.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{member.phone || 'N/A'}</div>
                        <div className="text-sm text-gray-500">{member.email || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{member.gender || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {formatDate(member.dateOfBirth)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{member.cnic || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500">
                          {memberPackage ? (
                            <div>
                              <div className="font-medium">{memberPackage.name}</div>
                              <div className="text-xs text-gray-400">Rs. {memberPackage.price.toLocaleString()}</div>
                            </div>
                          ) : (
                            'No package'
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-primary">
                          Rs. {monthlyTotal > 0 ? monthlyTotal.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '0'}
                        </div>
                        <div className="text-xs text-gray-400">per month</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500">
                          {memberTrainer ? (
                            <div>
                              <div>{memberTrainer.name}</div>
                              <div className="text-xs text-gray-400">Rs. {memberTrainer.charges?.toLocaleString()}/mo</div>
                            </div>
                          ) : (
                            'No trainer'
                          )}
                        </div>
                      </td>
                      {user?.role === 'GYM_ADMIN' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleEdit(member)}
                            className="text-blue hover:text-blue-900 mr-4"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(member.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}


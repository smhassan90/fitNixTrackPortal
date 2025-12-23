'use client';

import { useState, useMemo } from 'react';
import Layout from '@/components/Layout';
import { mockMembers, mockTrainers, mockPackages } from '@/lib/mockData';
import { useAuth } from '@/contexts/AuthContext';

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
  trainers: Trainer[];
}

export default function MembersPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>(mockMembers.map(m => ({
    ...m,
    gender: null,
    dateOfBirth: null,
    cnic: null,
    comments: null,
    packageId: null,
  })));
  const [trainers] = useState<Trainer[]>(mockTrainers);
  const [packages] = useState<Package[]>(mockPackages);
  const [loading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
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
  });

  // Filter members based on search query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    
    const query = searchQuery.toLowerCase();
    return members.filter(member =>
      member.name.toLowerCase().includes(query) ||
      member.phone?.toLowerCase().includes(query) ||
      member.email?.toLowerCase().includes(query) ||
      member.cnic?.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

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
          trainers: formData.requiresTrainer && formData.trainerId
            ? trainers.filter(t => t.id === formData.trainerId)
            : [],
        };
        setMembers([...members, newMember]);
        setShowAddForm(false);
      }
      resetForm();
    } catch (error: any) {
      alert('Failed to save member');
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
    });
  };

  const selectedTrainer = trainers.find(t => t.id === formData.trainerId);
  const selectedPackage = packages.find(p => p.id === formData.packageId);

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
    
    return total;
  }, [selectedPackage, selectedTrainer]);

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
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
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
                    onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
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
                    {packages.map((pkg) => (
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
                    placeholder="Add any additional comments or notes about this member..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  />
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
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-light-gray">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                  Gender
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                  Date of Birth
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                  CNIC
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                  Package
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                  Monthly Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                  Trainer
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
                  const memberPackage = packages.find(p => p.id === member.packageId);
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
                          {member.dateOfBirth ? new Date(member.dateOfBirth).toLocaleDateString() : 'N/A'}
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
    </Layout>
  );
}


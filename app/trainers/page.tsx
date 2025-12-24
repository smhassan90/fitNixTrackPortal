'use client';

import { useState, useMemo } from 'react';
import Layout from '@/components/Layout';
import Alert from '@/components/Alert';
import Loading from '@/components/Loading';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { mockTrainers } from '@/lib/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/dateUtils';
import { useAlert } from '@/hooks/useAlert';
import { generatePrefixedId } from '@/lib/idUtils';

interface Trainer {
  id: string;
  name: string;
  gender: string | null;
  dateOfBirth: string | null;
  specialization: string | null;
  charges?: number;
  startTime?: string;
  endTime?: string;
  _count?: {
    members: number;
  };
}

export default function TrainersPage() {
  const { user } = useAuth();
  const { alert, showAlert, closeAlert } = useAlert();
  const [trainers, setTrainers] = useState<Trainer[]>(mockTrainers);
  const [loading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; trainerId: string | null; trainerName: string }>({
    isOpen: false,
    trainerId: null,
    trainerName: '',
  });
  const [formData, setFormData] = useState({
    name: '',
    gender: '',
    dateOfBirth: '',
    specialization: '',
    charges: '',
    startTime: '',
    endTime: '',
  });

  const specializationOptions = [
    'Strength Training',
    'Cardio & Weight Loss',
    'Bodybuilding',
    'Yoga & Flexibility',
    'CrossFit',
    'Powerlifting',
    'General Fitness',
    'Rehabilitation',
    'Nutrition & Diet',
    'Other',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTrainer) {
        setTrainers(trainers.map(t => 
          t.id === editingTrainer.id 
            ? { 
                ...t, 
                name: formData.name,
                gender: formData.gender || null,
                dateOfBirth: formData.dateOfBirth || null,
                specialization: formData.specialization || null,
                charges: formData.charges ? parseFloat(formData.charges) : undefined,
                startTime: formData.startTime || undefined,
                endTime: formData.endTime || undefined,
              }
            : t
        ));
      } else {
        const newTrainer: Trainer = {
          id: generatePrefixedId('trainer'),
          name: formData.name,
          gender: formData.gender || null,
          dateOfBirth: formData.dateOfBirth || null,
          specialization: formData.specialization || null,
          charges: formData.charges ? parseFloat(formData.charges) : undefined,
          startTime: formData.startTime || undefined,
          endTime: formData.endTime || undefined,
          _count: { members: 0 },
        };
        setTrainers([...trainers, newTrainer]);
      }
      setShowAddForm(false);
      setEditingTrainer(null);
      resetForm();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showAlert('success', 'Trainer Saved', editingTrainer ? 'Trainer updated successfully!' : 'Trainer added successfully!');
    } catch (error: any) {
      showAlert('error', 'Error', 'Failed to save trainer. Please try again.');
    }
  };

  const handleEdit = (trainer: Trainer) => {
    setEditingTrainer(trainer);
    setShowAddForm(false);
    setFormData({
      name: trainer.name,
      gender: trainer.gender || '',
      dateOfBirth: trainer.dateOfBirth ? trainer.dateOfBirth.split('T')[0] : '',
      specialization: trainer.specialization || '',
      charges: trainer.charges?.toString() || '',
      startTime: trainer.startTime || '',
      endTime: trainer.endTime || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteDialog({
      isOpen: true,
      trainerId: id,
      trainerName: name,
    });
  };

  const handleDeleteConfirm = () => {
    if (deleteDialog.trainerId) {
      setTrainers(trainers.filter(t => t.id !== deleteDialog.trainerId));
      showAlert('success', 'Trainer Deleted', `Trainer "${deleteDialog.trainerName}" has been deleted successfully.`);
      setDeleteDialog({ isOpen: false, trainerId: null, trainerName: '' });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ isOpen: false, trainerId: null, trainerName: '' });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      gender: '',
      dateOfBirth: '',
      specialization: '',
      charges: '',
      startTime: '',
      endTime: '',
    });
  };

  // Handle sorting
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Sort trainers
  const sortedTrainers = useMemo(() => {
    if (!sortConfig) return trainers;

    return [...trainers].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.key) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'gender':
          aValue = a.gender?.toLowerCase() || '';
          bValue = b.gender?.toLowerCase() || '';
          break;
        case 'dateOfBirth':
          aValue = a.dateOfBirth ? new Date(a.dateOfBirth).getTime() : 0;
          bValue = b.dateOfBirth ? new Date(b.dateOfBirth).getTime() : 0;
          break;
        case 'specialization':
          aValue = a.specialization?.toLowerCase() || '';
          bValue = b.specialization?.toLowerCase() || '';
          break;
        case 'charges':
          aValue = a.charges || 0;
          bValue = b.charges || 0;
          break;
        case 'membersAssigned':
          aValue = a._count?.members || 0;
          bValue = b._count?.members || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [trainers, sortConfig]);

  const openAddForm = () => {
    setEditingTrainer(null);
    resetForm();
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setEditingTrainer(null);
    setShowAddForm(false);
    resetForm();
  };

  if (loading) {
    return (
      <Layout>
        <Loading message="Loading trainers..." />
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
        isOpen={deleteDialog.isOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Trainer"
        message={`Are you sure you want to delete "${deleteDialog.trainerName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-dark-gray">Trainers</h1>
          {user?.role === 'GYM_ADMIN' && !showAddForm && !editingTrainer && (
            <button
              onClick={openAddForm}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-colors"
            >
              + Add Trainer
            </button>
          )}
        </div>

        {/* Add/Edit Form */}
        {(showAddForm || editingTrainer) && (
          <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-dark-gray">
                {editingTrainer ? 'Edit Trainer' : 'Add New Trainer'}
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
                  <label className="block text-sm font-medium text-dark-gray mb-1">
                    Specialization
                  </label>
                  <select
                    value={formData.specialization}
                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Select Specialization</option>
                    {specializationOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-1">
                    Charges (per month)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="999999"
                    step="100"
                    value={formData.charges}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 999999)) {
                        setFormData({ ...formData, charges: value });
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="e.g., 5000"
                  />
                  {formData.charges && (
                    <p className="text-xs text-gray-500 mt-1">
                      Rs. {parseFloat(formData.charges || '0').toLocaleString()} per month
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-2">
                    Available Timings
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-600 mb-1">From</label>
                      <input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-600 mb-1">To</label>
                      <input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-primary text-white py-2 px-4 rounded-lg hover:bg-opacity-90 transition-colors font-medium"
                >
                  {editingTrainer ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 bg-gray-300 text-dark-gray py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors font-medium"
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
                  onClick={() => handleSort('specialization')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Specialization</span>
                    {sortConfig?.key === 'specialization' && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                  onClick={() => handleSort('charges')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Charges</span>
                    {sortConfig?.key === 'charges' && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                  Available Timings
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                  onClick={() => handleSort('membersAssigned')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Members Assigned</span>
                    {sortConfig?.key === 'membersAssigned' && (
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
              {sortedTrainers.map((trainer) => (
                <tr key={trainer.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-dark-gray">{trainer.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {trainer.gender || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {formatDate(trainer.dateOfBirth)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {trainer.specialization || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {trainer.charges ? `Rs. ${trainer.charges.toLocaleString()}/mo` : 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {trainer.startTime && trainer.endTime ? (
                        `${trainer.startTime} - ${trainer.endTime}`
                      ) : (
                        'Not set'
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{trainer._count?.members || 0}</div>
                  </td>
                  {user?.role === 'GYM_ADMIN' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(trainer)}
                        className="text-blue hover:text-blue-900 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(trainer.id, trainer.name)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}



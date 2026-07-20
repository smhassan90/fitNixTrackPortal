'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import Alert from '@/components/Alert';
import { FilterBarSkeleton, Skeleton, TableSkeleton } from '@/components/Skeleton';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/dateUtils';
import { useAlert } from '@/hooks/useAlert';
import api from '@/lib/api';
import { getErrorMessage, isForbiddenError } from '@/lib/errorHandler';

interface Trainer {
  id: string;
  name: string;
  phone?: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  specialization: string | null;
  charges?: number;
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
  _count?: {
    members: number;
  };
}

type TrainerStatusFilter = 'all' | 'active' | 'inactive';

function trainerIsActive(trainer: Trainer): boolean {
  return trainer.isActive !== false;
}

function statusBadge(trainer: Trainer) {
  if (!trainerIsActive(trainer)) {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
        Inactive
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
      Active
    </span>
  );
}

const emptyForm = () => ({
  name: '',
  phone: '',
  gender: '',
  dateOfBirth: '',
  specialization: '',
  charges: '',
  startTime: '',
  endTime: '',
});

function trainerToForm(trainer: Trainer) {
  return {
    name: trainer.name || '',
    phone: trainer.phone ?? '',
    gender: trainer.gender || '',
    dateOfBirth: trainer.dateOfBirth ? trainer.dateOfBirth.split('T')[0] : '',
    specialization: trainer.specialization || '',
    charges: trainer.charges?.toString() || '',
    startTime: trainer.startTime || '',
    endTime: trainer.endTime || '',
  };
}

export default function TrainersPage() {
  const { can } = useAuth();
  const canRead = can('gym.trainers.read');
  const canManage = can('gym.trainers.manage');
  const canDelete = can('gym.trainers.delete');
  const showActions = canManage || canDelete;
  const { alert, showAlert, closeAlert } = useAlert();
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TrainerStatusFilter>('all');
  const [statusSubmittingId, setStatusSubmittingId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; trainerId: string | null; trainerName: string }>({
    isOpen: false,
    trainerId: null,
    trainerName: '',
  });
  const [formData, setFormData] = useState(emptyForm);

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

  // Fetch trainers from API
  const fetchTrainers = useCallback(async (opts?: { silent?: boolean }) => {
    if (!canRead) {
      setTrainers([]);
      if (!opts?.silent) setLoading(false);
      return;
    }
    try {
      if (!opts?.silent) setLoading(true);
      console.log('🔵 Fetching trainers from API...');
      const params = new URLSearchParams();
      if (sortConfig?.key) params.append('sortBy', sortConfig.key);
      if (sortConfig?.direction) params.append('sortOrder', sortConfig.direction);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (statusFilter === 'active') params.append('isActive', 'true');
      if (statusFilter === 'inactive') params.append('isActive', 'false');
      params.append('limit', '1000');

      const response = await api.get(`/api/trainers?${params}`);
      console.log('Trainers API Response:', response.data);

      if (response.data.success) {
        const trainersList = (response.data.data.trainers || []).map((t: Trainer) => ({
          ...t,
          isActive: t.isActive !== false,
        }));
        setTrainers(trainersList);
        console.log('✅ Trainers loaded:', trainersList.length);
      }
    } catch (error: any) {
      console.error('Error fetching trainers:', error);
      if (!isForbiddenError(error)) {
        showAlert('error', 'Error', getErrorMessage(error));
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [canRead, sortConfig, searchQuery, statusFilter, showAlert]);

  // Load trainers on mount and when sort/search changes
  useEffect(() => {
    fetchTrainers();
  }, [fetchTrainers]);

  const buildCreatePayload = () => {
    const phone = formData.phone.trim();
    const trainerData: Record<string, unknown> = {
      name: formData.name.trim(),
    };
    if (phone) trainerData.phone = phone;
    if (formData.gender) trainerData.gender = formData.gender;
    if (formData.dateOfBirth) trainerData.dateOfBirth = formData.dateOfBirth;
    if (formData.specialization) trainerData.specialization = formData.specialization;
    if (formData.charges) trainerData.charges = parseFloat(formData.charges);
    if (formData.startTime) trainerData.startTime = formData.startTime;
    if (formData.endTime) trainerData.endTime = formData.endTime;
    return trainerData;
  };

  /** PUT body: only changed fields; empty phone clears as null. */
  const buildUpdatePayload = (baseline: Trainer) => {
    const payload: Record<string, unknown> = {};
    const name = formData.name.trim();
    if (name !== (baseline.name || '')) payload.name = name;

    const nextPhone = formData.phone.trim() || null;
    const prevPhone = baseline.phone?.trim() || null;
    if (nextPhone !== prevPhone) payload.phone = nextPhone;

    const nextGender = formData.gender || null;
    const prevGender = baseline.gender || null;
    if (nextGender !== prevGender) payload.gender = nextGender;

    const nextDob = formData.dateOfBirth || null;
    const prevDob = baseline.dateOfBirth ? baseline.dateOfBirth.split('T')[0] : null;
    if (nextDob !== prevDob) payload.dateOfBirth = nextDob;

    const nextSpec = formData.specialization || null;
    const prevSpec = baseline.specialization || null;
    if (nextSpec !== prevSpec) payload.specialization = nextSpec;

    const nextCharges = formData.charges ? parseFloat(formData.charges) : null;
    const prevCharges =
      baseline.charges != null && Number.isFinite(Number(baseline.charges))
        ? Number(baseline.charges)
        : null;
    if (nextCharges !== prevCharges) payload.charges = nextCharges;

    const nextStart = formData.startTime || null;
    const prevStart = baseline.startTime || null;
    if (nextStart !== prevStart) payload.startTime = nextStart;

    const nextEnd = formData.endTime || null;
    const prevEnd = baseline.endTime || null;
    if (nextEnd !== prevEnd) payload.endTime = nextEnd;

    return payload;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);

      if (editingTrainer) {
        const trainerData = buildUpdatePayload(editingTrainer);
        if (Object.keys(trainerData).length === 0) {
          showAlert('info', 'No changes', 'Nothing to update.');
          setLoading(false);
          return;
        }
        console.log('🔵 Updating trainer:', editingTrainer.id, trainerData);
        const response = await api.put(`/api/trainers/${editingTrainer.id}`, trainerData);
        console.log('Update trainer response:', response.data);

        if (response.data.success) {
          showAlert('success', 'Trainer Updated', 'Trainer updated successfully!');
          await fetchTrainers();
          setEditingTrainer(null);
          resetForm();
          setShowAddForm(false);
        }
      } else {
        const trainerData = buildCreatePayload();
        console.log('🔵 Creating new trainer', trainerData);
        const response = await api.post('/api/trainers', trainerData);
        console.log('Create trainer response:', response.data);

        if (response.data.success) {
          showAlert('success', 'Trainer Added', 'Trainer added successfully!');
          await fetchTrainers();
          setShowAddForm(false);
          resetForm();
        }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      console.error('Error saving trainer:', error);
      showAlert('error', 'Error', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (trainer: Trainer) => {
    setShowAddForm(false);
    setEditingTrainer(trainer);
    setFormData(trainerToForm(trainer));
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const response = await api.get(`/api/trainers/${trainer.id}`);
      if (response.data?.success) {
        const detail =
          response.data.data?.trainer ?? response.data.data ?? null;
        if (detail && typeof detail === 'object') {
          const full = detail as Trainer;
          setEditingTrainer(full);
          setFormData(trainerToForm(full));
        }
      }
    } catch (error: unknown) {
      // List row still usable if detail fetch fails
      console.error('Error loading trainer detail:', error);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteDialog({
      isOpen: true,
      trainerId: id,
      trainerName: name,
    });
  };

  const handleDeleteConfirm = async () => {
    if (deleteDialog.trainerId) {
      try {
        setLoading(true);
        console.log('🔵 Deleting trainer:', deleteDialog.trainerId);
        const response = await api.delete(`/api/trainers/${deleteDialog.trainerId}`);
        console.log('Delete trainer response:', response.data);
        
        if (response.data.success) {
          showAlert('success', 'Trainer Deleted', `Trainer "${deleteDialog.trainerName}" has been deleted successfully.`);
          await fetchTrainers(); // Refresh list
          setDeleteDialog({ isOpen: false, trainerId: null, trainerName: '' });
        }
      } catch (error: any) {
        console.error('Error deleting trainer:', error);
        showAlert('error', 'Error', getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ isOpen: false, trainerId: null, trainerName: '' });
  };

  const handleToggleActive = async (trainer: Trainer) => {
    if (statusSubmittingId) return;
    const nextActive = !trainerIsActive(trainer);
    const endpoint = nextActive ? 'activate' : 'deactivate';
    try {
      setStatusSubmittingId(trainer.id);
      const response = await api.patch(`/api/trainers/${trainer.id}/${endpoint}`);
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || `Could not ${endpoint} trainer`);
      }
      showAlert(
        'success',
        nextActive ? 'Trainer activated' : 'Trainer deactivated',
        `${trainer.name} is now ${nextActive ? 'active' : 'inactive'}.`
      );
      await fetchTrainers({ silent: true });
    } catch (error: unknown) {
      showAlert('error', 'Error', getErrorMessage(error));
    } finally {
      setStatusSubmittingId(null);
    }
  };

  const resetForm = () => {
    setFormData(emptyForm());
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setSearchQuery(searchInput);
    }
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
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
        case 'phone':
          aValue = a.phone?.toLowerCase() || '';
          bValue = b.phone?.toLowerCase() || '';
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

  const showPageSkeleton = loading && trainers.length === 0;

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
        message={`Are you sure you want to delete "${deleteDialog.trainerName}"? This action cannot be undone. Prefer Deactivate if you may need this trainer again.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-dark-gray">Trainers</h1>
          {canManage && !showAddForm && !editingTrainer && (
            showPageSkeleton ? (
              <Skeleton className="h-10 w-32" />
            ) : (
            <button
              onClick={openAddForm}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-colors"
            >
              + Add Trainer
            </button>
            )
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
                  <label className="block text-sm font-medium text-dark-gray mb-1">
                    Phone number
                  </label>
                  <input
                    type="tel"
                    maxLength={40}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="03001234567"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Optional · {formData.phone.length}/40 characters
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

        {showPageSkeleton ? (
          <>
            <FilterBarSkeleton fields={2} />
            <TableSkeleton rows={8} columns={showActions ? 8 : 7} />
          </>
        ) : (
          <>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search name, phone…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <svg
                  className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-dark-gray sm:sr-only">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TrainerStatusFilter)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-dark-gray focus:border-transparent focus:ring-2 focus:ring-primary sm:w-auto"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => setSearchQuery(searchInput)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90 transition-colors"
            >
              Go
            </button>
            {(searchQuery || searchInput || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  handleClearSearch();
                  setStatusFilter('all');
                }}
                className="px-4 py-2 border border-gray-300 text-dark-gray rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

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
                  onClick={() => handleSort('phone')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Phone</span>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                  Status
                </th>
                {showActions && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedTrainers.length === 0 ? (
                <tr>
                  <td
                    colSpan={showActions ? 10 : 9}
                    className="px-6 py-10 text-center text-sm text-gray-500"
                  >
                    {searchQuery || statusFilter !== 'all'
                      ? 'No trainers found matching your filters.'
                      : 'No trainers found.'}
                  </td>
                </tr>
              ) : (
              sortedTrainers.map((trainer) => {
                const active = trainerIsActive(trainer);
                const memberCount = trainer._count?.members || 0;
                return (
                <tr
                  key={trainer.id}
                  className={active ? 'hover:bg-gray-50' : 'bg-gray-50/80 text-gray-500 hover:bg-gray-100/80'}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-medium ${active ? 'text-dark-gray' : 'text-gray-500'}`}>
                      {trainer.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {trainer.phone?.trim() ? trainer.phone : '—'}
                    </div>
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
                    <div className="text-sm text-gray-500">{memberCount}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{statusBadge(trainer)}</td>
                  {showActions && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {canManage && (
                        <button
                          onClick={() => handleEdit(trainer)}
                          className="text-blue hover:text-blue-900 mr-3"
                        >
                          Edit
                        </button>
                      )}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => void handleToggleActive(trainer)}
                          disabled={statusSubmittingId === trainer.id}
                          className="mr-3 text-primary hover:text-primary-dark disabled:opacity-50"
                        >
                          {statusSubmittingId === trainer.id
                            ? 'Saving…'
                            : active
                              ? 'Deactivate'
                              : 'Activate'}
                        </button>
                      )}
                      {canDelete &&
                        (memberCount === 0 ? (
                          <button
                            onClick={() => handleDeleteClick(trainer.id, trainer.name)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        ) : (
                          <span
                            className="text-xs text-gray-400"
                            title="Delete is blocked while members are assigned. Use Deactivate instead."
                          >
                            —
                          </span>
                        ))}
                    </td>
                  )}
                </tr>
              );
              })
              )}
            </tbody>
          </table>
        </div>
          </>
        )}
      </div>
    </Layout>
  );
}



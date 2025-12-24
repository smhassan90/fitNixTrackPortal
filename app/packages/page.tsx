'use client';

import { useState, useMemo } from 'react';
import Layout from '@/components/Layout';
import Alert from '@/components/Alert';
import Loading from '@/components/Loading';
import { mockPackages } from '@/lib/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import { generatePrefixedId } from '@/lib/idUtils';

interface Package {
  id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
}

export default function PackagesPage() {
  const { user } = useAuth();
  const { alert, showAlert, closeAlert } = useAlert();
  const [packages, setPackages] = useState<Package[]>(mockPackages);
  const [loading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    duration: '',
    features: [] as string[],
  });

  const durationOptions = [
    '1 month',
    '3 months',
    '6 months',
    '12 months',
  ];

  const availableFeatures = [
    'Gym Access',
    'Locker Facility',
    'Group Classes',
    'Sauna Access',
    'Personal Training Session',
    'Nutrition Consultation',
    'Cardio Equipment',
    'Weight Training Equipment',
    'Swimming Pool',
    'Yoga Classes',
    'Zumba Classes',
    'Steam Room',
    'Towel Service',
    'Parking Facility',
    '24/7 Access',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.features.length === 0) {
      showAlert('warning', 'Features Required', 'Please select at least one feature for the package.');
      return;
    }
    
    try {
      if (editingPackage) {
        setPackages(packages.map(p => 
          p.id === editingPackage.id 
            ? { 
                ...p, 
                name: formData.name,
                price: parseFloat(formData.price),
                duration: formData.duration,
                features: formData.features,
              }
            : p
        ));
      } else {
        const newPackage: Package = {
          id: generatePrefixedId('package'),
          name: formData.name,
          price: parseFloat(formData.price),
          duration: formData.duration,
          features: formData.features,
        };
        setPackages([...packages, newPackage]);
      }
      setShowAddForm(false);
      setEditingPackage(null);
      resetForm();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showAlert('success', 'Package Saved', editingPackage ? 'Package updated successfully!' : 'Package added successfully!');
    } catch (error: any) {
      showAlert('error', 'Error', 'Failed to save package. Please try again.');
    }
  };

  const handleEdit = (pkg: Package) => {
    setEditingPackage(pkg);
    setShowAddForm(false);
    setFormData({
      name: pkg.name,
      price: pkg.price.toString(),
      duration: pkg.duration,
      features: pkg.features,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setEditingPackage(null);
    setShowAddForm(false);
    resetForm();
  };

  const handleFeatureToggle = (feature: string) => {
    setFormData({
      ...formData,
      features: formData.features.includes(feature)
        ? formData.features.filter(f => f !== feature)
        : [...formData.features, feature],
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this package?')) return;
    setPackages(packages.filter(p => p.id !== id));
  };

  // Handle sorting
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Sort packages
  const sortedPackages = useMemo(() => {
    if (!sortConfig) return packages;

    return [...packages].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.key) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'price':
          aValue = a.price;
          bValue = b.price;
          break;
        case 'duration':
          // Extract numeric value from duration string
          const aNum = parseInt(a.duration) || 0;
          const bNum = parseInt(b.duration) || 0;
          aValue = aNum;
          bValue = bNum;
          break;
        case 'features':
          aValue = a.features.length;
          bValue = b.features.length;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [packages, sortConfig]);

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      duration: '',
      features: [],
    });
  };

  const openAddForm = () => {
    setEditingPackage(null);
    resetForm();
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <Layout>
        <Loading message="Loading packages..." />
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
          <h1 className="text-3xl font-bold text-dark-gray">Packages</h1>
          {user?.role === 'GYM_ADMIN' && !showAddForm && !editingPackage && (
            <button
              onClick={openAddForm}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-colors"
            >
              + Add Package
            </button>
          )}
        </div>

        {/* Add/Edit Form */}
        {(showAddForm || editingPackage) && (
          <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-dark-gray">
                {editingPackage ? 'Edit Package' : 'Add New Package'}
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
            <form onSubmit={handleSubmit} className="space-y-4" onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.type !== 'checkbox') {
                e.preventDefault();
              }
            }}>
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
                    placeholder="e.g., Basic Package"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.name.length}/100 characters
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-1">Price (Rs.) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="99999999"
                    step="100"
                    value={formData.price}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 99999999)) {
                        setFormData({ ...formData, price: value });
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="e.g., 5000"
                  />
                  {formData.price && (
                    <p className="text-xs text-gray-500 mt-1">
                      Rs. {parseFloat(formData.price || '0').toLocaleString()}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-1">Duration *</label>
                  <select
                    required
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Select Duration</option>
                    {durationOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-gray mb-2">
                  Features *
                </label>
                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 max-h-80 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {availableFeatures.map((feature) => {
                      const isSelected = formData.features.includes(feature);
                      return (
                        <div
                          key={feature}
                          onClick={() => handleFeatureToggle(feature)}
                          className={`
                            relative p-4 rounded-lg border-2 cursor-pointer transition-all duration-200
                            ${isSelected
                              ? 'bg-primary border-primary text-white shadow-lg shadow-primary/30'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-primary hover:bg-primary/5 hover:shadow-md hover:shadow-primary/10'
                            }
                          `}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                              {feature}
                            </span>
                            <div className={`
                              w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                              ${isSelected
                                ? 'bg-white border-white'
                                : 'border-gray-300 bg-white'
                              }
                            `}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-primary" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="absolute top-1 right-1">
                              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {formData.features.length === 0 && (
                  <p className="text-xs text-red-500 mt-2 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Please select at least one feature
                  </p>
                )}
                {formData.features.length > 0 && (
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-gray-600 flex items-center">
                      <svg className="w-4 h-4 mr-1 text-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-semibold text-primary">{formData.features.length}</span>
                      <span className="ml-1">feature{formData.features.length !== 1 ? 's' : ''} selected</span>
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {formData.features.slice(0, 3).map((feature) => (
                        <span
                          key={feature}
                          className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium"
                        >
                          {feature}
                        </span>
                      ))}
                      {formData.features.length > 3 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-600 text-xs font-medium">
                          +{formData.features.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="bg-primary text-white py-2 px-6 rounded-lg hover:bg-opacity-90 transition-colors font-medium"
                >
                  {editingPackage ? 'Update Package' : 'Add Package'}
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
                  onClick={() => handleSort('price')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Price</span>
                    {sortConfig?.key === 'price' && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                  onClick={() => handleSort('duration')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Duration</span>
                    {sortConfig?.key === 'duration' && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                  onClick={() => handleSort('features')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Features</span>
                    {sortConfig?.key === 'features' && (
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
              {sortedPackages.map((pkg) => (
                <tr key={pkg.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-dark-gray">{pkg.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      Rs. {pkg.price.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{pkg.duration}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500">
                      <div className="flex flex-wrap gap-1">
                        {pkg.features.map((feature, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  {user?.role === 'GYM_ADMIN' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(pkg)}
                        className="text-blue hover:text-blue-900 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(pkg.id)}
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


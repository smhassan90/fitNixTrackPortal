'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Alert from '@/components/Alert';
import Loading from '@/components/Loading';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errorHandler';

interface Settings {
  admissionFee: number;
  gym: {
    id: number;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { alert, showAlert, closeAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [admissionAmount, setAdmissionAmount] = useState<string>('');

  // Fetch settings from API
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/settings');
      if (response.data.success) {
        setSettings(response.data.data);
        setAdmissionAmount(response.data.data.admissionFee.toString());
      }
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      showAlert('error', 'Error', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    const amount = parseFloat(admissionAmount);
    if (isNaN(amount) || amount < 0) {
      showAlert('error', 'Invalid Amount', 'Please enter a valid admission fee amount (must be 0 or greater).');
      return;
    }

    // Check if user is admin
    if (user?.role !== 'GYM_ADMIN') {
      showAlert('error', 'Access Denied', 'Only administrators can update settings.');
      return;
    }

    try {
      setSaving(true);
      const response = await api.put('/api/settings', {
        admissionFee: amount,
      });

      if (response.data.success) {
        setSettings(response.data.data);
        setAdmissionAmount(response.data.data.admissionFee.toString());
        showAlert('success', 'Settings Saved', response.data.message || 'Admission fee has been updated successfully!');
      }
    } catch (error: any) {
      console.error('Error updating settings:', error);
      if (error.response?.status === 403) {
        showAlert('error', 'Access Denied', 'Only administrators can update settings.');
      } else {
        showAlert('error', 'Error', getErrorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <Loading message="Loading settings..." />
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
          <div>
            <h1 className="text-3xl font-bold text-dark-gray">Settings</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your gym settings and preferences</p>
          </div>
        </div>

        {/* Settings Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Admission Fee Settings */}
          <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
            <div className="flex items-center mb-4">
              <div className="bg-primary bg-opacity-10 p-3 rounded-lg mr-3">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-dark-gray">Admission Fee</h2>
                <p className="text-sm text-gray-500">Set the default admission fee for new members</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-gray mb-2">
                  Admission Fee Amount (Rs.)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="999999"
                    step="100"
                    value={admissionAmount}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 999999)) {
                        setAdmissionAmount(value);
                      }
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="1000"
                  />
                  <button
                    onClick={handleSave}
                    className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium"
                  >
                    Save
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  This amount will be charged as a one-time admission fee when adding new members.
                  You can waive it for individual members during member creation.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-dark-gray">Current Admission Fee</p>
                    <p className="text-2xl font-bold text-primary mt-1">
                      Rs. {parseFloat(admissionAmount || '0').toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-primary bg-opacity-10 p-3 rounded-full">
                    <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-gradient-to-br from-primary to-primary-dark p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center mb-4">
              <svg className="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-bold">About Admission Fee</h2>
            </div>
            <ul className="space-y-2 text-sm opacity-90">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Set once and applies to all new members</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Can be waived for individual members during creation</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Included in the one-time payment calculation</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Shown in membership receipts</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}


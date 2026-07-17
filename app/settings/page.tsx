'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import Alert from '@/components/Alert';
import { SettingsContentSkeleton } from '@/components/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errorHandler';
import {
  applyAttendancePolicies,
  fetchGymSettings,
  saveAttendanceSettings,
  type GymSettings,
} from '@/lib/attendanceApi';
import {
  addAttendanceDevice,
  fetchTabletSyncSetup,
  isValidDeviceIpAddress,
  type TabletSyncSetup,
} from '@/lib/deviceApi';

type SettingsTab = 'general' | 'attendance' | 'devices';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'attendance', label: 'Attendance automation' },
  { id: 'devices', label: 'Tablet setup' },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { alert, showAlert, closeAlert } = useAlert();
  const isAdmin = user?.role === 'GYM_ADMIN';

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applyingPolicies, setApplyingPolicies] = useState(false);
  const [settings, setSettings] = useState<GymSettings | null>(null);

  const [admissionAmount, setAdmissionAmount] = useState('');
  const [maxMemberDiscountAmount, setMaxMemberDiscountAmount] = useState('');
  const [autoCheckoutHours, setAutoCheckoutHours] = useState('6');
  const [absenceEnabled, setAbsenceEnabled] = useState(false);
  const [absenceInactiveDays, setAbsenceInactiveDays] = useState('14');

  const [deviceSetup, setDeviceSetup] = useState<TabletSyncSetup | null>(null);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceIp, setNewDeviceIp] = useState('');
  const [addingDevice, setAddingDevice] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchGymSettings();
      setSettings(data);
      setAdmissionAmount(data.admissionFee.toString());
      setMaxMemberDiscountAmount(data.maxMemberDiscount.toString());
      setAutoCheckoutHours(String(data.autoCheckoutHours));
      setAbsenceEnabled(data.attendancePolicy.absenceInactiveEnabled);
      setAbsenceInactiveDays(
        data.absenceInactiveDays != null ? String(data.absenceInactiveDays) : '14'
      );
    } catch (error: unknown) {
      showAlert('error', 'Error', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  const fetchDevices = useCallback(async () => {
    try {
      setDevicesLoading(true);
      const setup = await fetchTabletSyncSetup();
      setDeviceSetup(setup);
    } catch (error: unknown) {
      showAlert('error', 'Devices', getErrorMessage(error));
      setDeviceSetup(null);
    } finally {
      setDevicesLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (activeTab === 'devices') void fetchDevices();
  }, [activeTab, fetchDevices]);

  const handleSaveMaxMemberDiscount = async () => {
    const amount = parseFloat(maxMemberDiscountAmount);
    if (Number.isNaN(amount) || amount < 0) {
      showAlert('error', 'Invalid Amount', 'Please enter a valid maximum discount (0 or greater).');
      return;
    }
    if (!isAdmin) {
      showAlert('error', 'Access Denied', 'Only administrators can update settings.');
      return;
    }

    try {
      setSaving(true);
      const response = await api.put('/api/settings', { maxMemberDiscount: amount });
      if (response.data.success) {
        const data = await fetchGymSettings();
        setSettings(data);
        setMaxMemberDiscountAmount(data.maxMemberDiscount.toString());
        showAlert(
          'success',
          'Settings Saved',
          response.data.message || 'Maximum member discount updated.'
        );
      }
    } catch (error: unknown) {
      showAlert('error', 'Error', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAdmission = async () => {
    const amount = parseFloat(admissionAmount);
    if (Number.isNaN(amount) || amount < 0) {
      showAlert('error', 'Invalid Amount', 'Please enter a valid admission fee (0 or greater).');
      return;
    }
    if (!isAdmin) {
      showAlert('error', 'Access Denied', 'Only administrators can update settings.');
      return;
    }

    try {
      setSaving(true);
      const response = await api.put('/api/settings', { admissionFee: amount });
      if (response.data.success) {
        const data = await fetchGymSettings();
        setSettings(data);
        setAdmissionAmount(data.admissionFee.toString());
        showAlert('success', 'Settings Saved', response.data.message || 'Admission fee updated.');
      }
    } catch (error: unknown) {
      showAlert('error', 'Error', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAttendance = async () => {
    if (!isAdmin) {
      showAlert('error', 'Access Denied', 'Only administrators can update attendance policies.');
      return;
    }

    const hours = parseInt(autoCheckoutHours, 10);
    if (Number.isNaN(hours) || hours < 1 || hours > 24) {
      showAlert('error', 'Invalid value', 'Auto sign-out hours must be between 1 and 24.');
      return;
    }

    let absenceDays: number | null = null;
    if (absenceEnabled) {
      const days = parseInt(absenceInactiveDays, 10);
      if (Number.isNaN(days) || days < 1 || days > 365) {
        showAlert('error', 'Invalid value', 'Absence days must be between 1 and 365.');
        return;
      }
      absenceDays = days;
    }

    try {
      setSaving(true);
      const data = await saveAttendanceSettings({
        autoCheckoutHours: hours,
        absenceInactiveDays: absenceDays,
      });
      setSettings(data);
      setAutoCheckoutHours(String(data.autoCheckoutHours));
      setAbsenceEnabled(data.attendancePolicy.absenceInactiveEnabled);
      showAlert('success', 'Policies Saved', 'Attendance automation settings updated.');
    } catch (error: unknown) {
      showAlert('error', 'Error', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleApplyPolicies = async () => {
    if (!isAdmin) {
      showAlert('error', 'Access Denied', 'Only administrators can apply policies.');
      return;
    }
    try {
      setApplyingPolicies(true);
      const result = await applyAttendancePolicies();
      const parts: string[] = [];
      if (result.autoCheckedOut > 0) parts.push(`Auto checked out ${result.autoCheckedOut}`);
      if (result.markedInactive > 0) parts.push(`Marked ${result.markedInactive} inactive`);
      showAlert(
        'success',
        'Policies Applied',
        parts.length > 0 ? `${parts.join('. ')}.` : result.message || 'Policies applied successfully.'
      );
    } catch (error: unknown) {
      showAlert('error', 'Error', getErrorMessage(error));
    } finally {
      setApplyingPolicies(false);
    }
  };

  const handleAddDevice = async () => {
    if (!isAdmin) {
      showAlert('error', 'Access Denied', 'Only administrators can add devices.');
      return;
    }
    if (!newDeviceName.trim()) {
      showAlert('error', 'Required', 'Enter a device name.');
      return;
    }
    if (!newDeviceIp.trim()) {
      showAlert('error', 'Required', 'Enter the device IP address.');
      return;
    }
    if (!isValidDeviceIpAddress(newDeviceIp)) {
      showAlert('error', 'Invalid IP', 'Enter a valid IPv4 address (e.g. 192.168.1.100).');
      return;
    }
    try {
      setAddingDevice(true);
      await addAttendanceDevice({
        name: newDeviceName.trim(),
        ipAddress: newDeviceIp.trim(),
      });
      setNewDeviceName('');
      setNewDeviceIp('');
      await fetchDevices();
      showAlert('success', 'Device Added', 'Attendance device registered.');
    } catch (error: unknown) {
      showAlert('error', 'Error', getErrorMessage(error));
    } finally {
      setAddingDevice(false);
    }
  };

  const copyApiKey = async () => {
    if (!deviceSetup?.apiKey) return;
    try {
      await navigator.clipboard.writeText(deviceSetup.apiKey);
      showAlert('success', 'Copied', 'API key copied to clipboard.');
    } catch {
      showAlert('error', 'Copy failed', 'Could not copy API key.');
    }
  };

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
        <div>
          <h1 className="text-3xl font-bold text-dark-gray">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            {settings?.gym.name ? `${settings.gym.name} · ` : ''}
            Manage gym preferences, attendance policies, and devices
          </p>
        </div>

        {loading ? (
          <SettingsContentSkeleton />
        ) : (
          <>
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap px-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'general' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
              <div className="flex items-center mb-4">
                <div className="bg-primary bg-opacity-10 p-3 rounded-lg mr-3">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-dark-gray">Admission Fee</h2>
                  <p className="text-sm text-gray-500">Default one-time fee for new members</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-2">
                    Admission Fee Amount (Rs.)
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
                      disabled={!isAdmin}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-50"
                      placeholder="1000"
                    />
                    <button
                      onClick={handleSaveAdmission}
                      disabled={!isAdmin || saving}
                      className="w-full rounded-lg bg-primary px-6 py-2 font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50 sm:w-auto"
                    >
                      Save
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Charged once at signup; can be waived per member during creation.
                  </p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-dark-gray">Current Admission Fee</p>
                  <p className="text-2xl font-bold text-primary mt-1">
                    Rs. {parseFloat(admissionAmount || '0').toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
              <div className="flex items-center mb-4">
                <div className="bg-primary bg-opacity-10 p-3 rounded-lg mr-3">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-dark-gray">Maximum Member Discount</h2>
                  <p className="text-sm text-gray-500">
                    Cap on flat PKR discount when adding or editing members
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-2">
                    Max discount per member (Rs.)
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                      type="number"
                      min="0"
                      max="999999"
                      step="100"
                      value={maxMemberDiscountAmount}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 999999)) {
                          setMaxMemberDiscountAmount(value);
                        }
                      }}
                      disabled={!isAdmin}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-50"
                      placeholder="5000"
                    />
                    <button
                      onClick={handleSaveMaxMemberDiscount}
                      disabled={!isAdmin || saving}
                      className="w-full rounded-lg bg-primary px-6 py-2 font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50 sm:w-auto"
                    >
                      Save
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Applied to monthly package + trainer fees (flat amount, not a percentage). The
                    Add Member form enforces this limit.
                  </p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-dark-gray">Current maximum</p>
                  <p className="text-2xl font-bold text-primary mt-1">
                    Rs. {parseFloat(maxMemberDiscountAmount || '0').toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-primary to-primary-dark p-6 rounded-lg shadow-lg text-white md:col-span-2">
              <h2 className="text-xl font-bold mb-4">About settings</h2>
              <ul className="space-y-2 text-sm opacity-90">
                <li>• Admission fee applies to all new members unless waived</li>
                <li>• Maximum member discount caps flat PKR discounts on the Add Member screen</li>
                <li>• Attendance automation controls auto checkout and absence rules</li>
                <li>• Tablet setup is one-time: API key and device registration for the attendance app</li>
                <li>• Sync users and map device users from Attendance → Sync users</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-dark-gray">Session timeout</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Auto sign-out members who forgot to punch out
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-gray mb-2">
                  Auto sign-out after (hours)
                </label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={autoCheckoutHours}
                  onChange={(e) => setAutoCheckoutHours(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary disabled:bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Members still &apos;in gym&apos; after this duration are auto checked out.
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-dark-gray">Absence policy</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Mark members inactive after prolonged absence
                </p>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={absenceEnabled}
                  onChange={(e) => setAbsenceEnabled(e.target.checked)}
                  disabled={!isAdmin}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-dark-gray">
                  Automatically mark inactive after absence
                </span>
              </label>
              {absenceEnabled && (
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-2">
                    Days without check-in
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={absenceInactiveDays}
                    onChange={(e) => setAbsenceInactiveDays(e.target.value)}
                    disabled={!isAdmin}
                    className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary disabled:bg-gray-50"
                  />
                </div>
              )}
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Unpaid installments from inactive date onward are removed (same as manual deactivate).
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:col-span-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={handleSaveAttendance}
                disabled={!isAdmin || saving}
                className="w-full rounded-lg bg-primary px-6 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50 sm:w-auto"
              >
                {saving ? 'Saving…' : 'Save attendance policies'}
              </button>
              <button
                type="button"
                onClick={handleApplyPolicies}
                disabled={!isAdmin || applyingPolicies}
                className="w-full rounded-lg border border-gray-300 bg-white px-6 py-2 font-medium text-dark-gray hover:bg-gray-50 disabled:opacity-50 sm:w-auto"
              >
                {applyingPolicies ? 'Applying…' : 'Apply policies now'}
              </button>
              {!isAdmin && (
                <p className="text-sm text-gray-500 self-center">
                  Only gym administrators can change attendance policies.
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'devices' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
              <h2 className="text-xl font-bold text-dark-gray mb-2">Tablet API key</h2>
              <p className="text-sm text-gray-500 mb-4">
                One-time setup: use this key in the attendance Android app. Keep the key confidential.
              </p>
              {devicesLoading ? (
                <p className="text-sm text-gray-500">Loading device setup…</p>
              ) : deviceSetup?.apiKey ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <code className="flex-1 min-w-0 px-4 py-2 bg-gray-100 rounded-lg text-sm font-mono break-all">
                    {deviceSetup.apiKey}
                  </code>
                  <button
                    type="button"
                    onClick={copyApiKey}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    Copy
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No API key available.</p>
              )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-dark-gray">Attendance devices</h2>
                  <p className="text-sm text-gray-500">
                    Register devices once to get a Device Config ID for the attendance Android app
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                    <input
                      type="text"
                      value={newDeviceName}
                      onChange={(e) => setNewDeviceName(e.target.value)}
                      placeholder="Device name (e.g. Front desk tablet)"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[200px]"
                    />
                    <input
                      type="text"
                      value={newDeviceIp}
                      onChange={(e) => setNewDeviceIp(e.target.value)}
                      placeholder="IP address (e.g. 192.168.1.100)"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[180px] font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleAddDevice}
                      disabled={addingDevice}
                      className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:w-auto"
                    >
                      {addingDevice ? 'Adding…' : 'Add device'}
                    </button>
                  </div>
                )}
              </div>

              {devicesLoading ? (
                <p className="text-sm text-gray-500">Loading devices…</p>
              ) : !deviceSetup?.devices.length ? (
                <p className="text-sm text-gray-500">No devices registered yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-light-gray">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">IP address</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Config ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Last sync</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {deviceSetup.devices.map((device) => (
                        <tr key={String(device.id)} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium">{device.name}</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600">
                            {device.ipAddress || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600">
                            {device.deviceConfigId || device.id}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {device.lastSyncAt
                              ? new Date(device.lastSyncAt).toLocaleString()
                              : 'Never'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-4">
                After devices are registered, sync users and map them from{' '}
                <Link href="/attendance?tab=sync-users" className="text-primary font-medium hover:underline">
                  Attendance → Sync users
                </Link>
                .
              </p>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </Layout>
  );
}

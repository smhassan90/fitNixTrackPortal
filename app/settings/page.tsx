'use client';

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import Alert from '@/components/Alert';
import Loading from '@/components/Loading';
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
import DeviceUserMappingModal from '@/components/DeviceUserMappingModal';
import {
  addAttendanceDevice,
  fetchTabletSyncSetup,
  isValidDeviceIpAddress,
  syncDeviceAttendance,
  syncDeviceUsers,
  type AttendanceDevice,
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
  const [mappingDevice, setMappingDevice] = useState<AttendanceDevice | null>(null);
  const [syncingDeviceId, setSyncingDeviceId] = useState<string | null>(null);
  const [mappingPrompt, setMappingPrompt] = useState<{
    device: AttendanceDevice;
    pending: number;
    unmappedCount: number;
  } | null>(null);

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

  const openMappingForDevice = (device: AttendanceDevice) => {
    setMappingPrompt(null);
    setMappingDevice(device);
  };

  const maybePromptMapping = (
    device: AttendanceDevice,
    opts: { pending?: number; unmappedCount?: number }
  ) => {
    const pending = opts.pending ?? 0;
    const unmappedCount = opts.unmappedCount ?? 0;
    if (pending > 0 || unmappedCount > 0) {
      setMappingPrompt({ device, pending, unmappedCount });
    }
  };

  const handleSyncUsers = async (device: AttendanceDevice) => {
    try {
      setSyncingDeviceId(`${device.id}:users`);
      const result = await syncDeviceUsers(device.id);
      showAlert(
        'success',
        'Users synced',
        result.message ||
          (result.unmappedCount > 0
            ? `Synced device users. ${result.unmappedCount} still need mapping.`
            : 'Device users synced.')
      );
      maybePromptMapping(device, { unmappedCount: result.unmappedCount });
    } catch (error: unknown) {
      showAlert('error', 'Sync failed', getErrorMessage(error));
    } finally {
      setSyncingDeviceId(null);
    }
  };

  const handleSyncAttendance = async (device: AttendanceDevice) => {
    try {
      setSyncingDeviceId(`${device.id}:attendance`);
      const result = await syncDeviceAttendance(device.id);
      showAlert(
        'success',
        'Attendance synced',
        result.message ||
          (result.pending > 0
            ? `Synced attendance. ${result.pending} pending punch(es) need user mapping.`
            : 'Attendance synced.')
      );
      maybePromptMapping(device, { pending: result.pending });
    } catch (error: unknown) {
      showAlert('error', 'Sync failed', getErrorMessage(error));
    } finally {
      setSyncingDeviceId(null);
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
      {mappingDevice && (
        <DeviceUserMappingModal
          isOpen={!!mappingDevice}
          deviceId={mappingDevice.id}
          deviceName={mappingDevice.name}
          onClose={() => setMappingDevice(null)}
          onSuccess={({ mapped, attendanceSynced, errors }) => {
            const summary = `Mapped ${mapped} user${mapped === 1 ? '' : 's'}. Applied ${attendanceSynced} attendance punch${attendanceSynced === 1 ? '' : 'es'}.`;
            if (errors.length > 0) {
              showAlert(
                'warning',
                'Mappings partially confirmed',
                `${summary}\n${errors.join('\n')}`
              );
            } else {
              showAlert('success', 'Mappings confirmed', summary);
            }
            setMappingPrompt(null);
          }}
          onError={(message) => showAlert('error', 'Mapping', message)}
        />
      )}
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-dark-gray">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            {settings?.gym.name ? `${settings.gym.name} · ` : ''}
            Manage gym preferences, attendance policies, and devices
          </p>
        </div>

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
                      disabled={!isAdmin}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-50"
                      placeholder="1000"
                    />
                    <button
                      onClick={handleSaveAdmission}
                      disabled={!isAdmin || saving}
                      className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium disabled:opacity-50"
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
                  <div className="flex items-center gap-3">
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
                      className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium disabled:opacity-50"
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
                <li>• Tablet setup provides the API key and device config for the attendance app</li>
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

            <div className="lg:col-span-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveAttendance}
                disabled={!isAdmin || saving}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save attendance policies'}
              </button>
              <button
                type="button"
                onClick={handleApplyPolicies}
                disabled={!isAdmin || applyingPolicies}
                className="px-6 py-2 border border-gray-300 bg-white text-dark-gray rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50"
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
                Use this key in the attendance Android app. The app pushes users and punches to the
                cloud API — no manual sync from this portal. Keep the key confidential.
              </p>
              {devicesLoading ? (
                <p className="text-sm text-gray-500">Loading device setup…</p>
              ) : deviceSetup?.apiKey ? (
                <div className="flex flex-wrap items-center gap-3">
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
                    Register devices to get a Device Config ID for the attendance Android app
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2">
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
                      className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {addingDevice ? 'Adding…' : 'Add device'}
                    </button>
                  </div>
                )}
              </div>

              {mappingPrompt && (
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="text-sm text-amber-900">
                    <span className="font-semibold">{mappingPrompt.device.name}</span>
                    {' has '}
                    {mappingPrompt.unmappedCount > 0 && (
                      <span>
                        {mappingPrompt.unmappedCount} unmapped user
                        {mappingPrompt.unmappedCount === 1 ? '' : 's'}
                      </span>
                    )}
                    {mappingPrompt.unmappedCount > 0 && mappingPrompt.pending > 0 && ' and '}
                    {mappingPrompt.pending > 0 && (
                      <span>
                        {mappingPrompt.pending} pending punch
                        {mappingPrompt.pending === 1 ? '' : 'es'}
                      </span>
                    )}
                    . Map them so attendance can be applied.
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setMappingPrompt(null)}
                      className="px-3 py-1.5 text-sm text-amber-800 hover:underline"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={() => openMappingForDevice(mappingPrompt.device)}
                      className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium"
                    >
                      Map users now
                    </button>
                  </div>
                </div>
              )}

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
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Last push</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-dark-gray">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {deviceSetup.devices.map((device) => {
                        const usersBusy = syncingDeviceId === `${device.id}:users`;
                        const attendanceBusy = syncingDeviceId === `${device.id}:attendance`;
                        const anyBusy = syncingDeviceId != null;
                        return (
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
                            <td className="px-4 py-3 text-sm text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openMappingForDevice(device)}
                                  className="px-3 py-1.5 border border-primary text-primary rounded-lg text-xs font-medium hover:bg-primary/5"
                                >
                                  Map users
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleSyncUsers(device)}
                                  disabled={anyBusy}
                                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                                >
                                  {usersBusy ? 'Syncing…' : 'Sync users'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleSyncAttendance(device)}
                                  disabled={anyBusy}
                                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                                >
                                  {attendanceBusy ? 'Syncing…' : 'Sync attendance'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-4">
                Sync pulls users and punches from the device. Unmapped punches stay pending until you
                map device users to members. Use Attendance automation for checkout and absence policies.
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

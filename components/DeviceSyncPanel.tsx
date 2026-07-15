'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import DeviceUserMappingModal from '@/components/DeviceUserMappingModal';
import { useAlert } from '@/hooks/useAlert';
import Alert from '@/components/Alert';
import {
  fetchTabletSyncSetup,
  syncDeviceAttendance,
  syncDeviceUsers,
  type AttendanceDevice,
  type TabletSyncSetup,
} from '@/lib/deviceApi';
import { getErrorMessage } from '@/lib/errorHandler';

export default function DeviceSyncPanel() {
  const { alert, showAlert, closeAlert } = useAlert();
  const [deviceSetup, setDeviceSetup] = useState<TabletSyncSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [mappingDevice, setMappingDevice] = useState<AttendanceDevice | null>(null);
  const [syncingDeviceId, setSyncingDeviceId] = useState<string | null>(null);
  const [mappingPrompt, setMappingPrompt] = useState<{
    device: AttendanceDevice;
    pending: number;
    unmappedCount: number;
  } | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      const setup = await fetchTabletSyncSetup();
      setDeviceSetup(setup);
    } catch (error: unknown) {
      showAlert('error', 'Devices', getErrorMessage(error));
      setDeviceSetup(null);
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    void fetchDevices();
  }, [fetchDevices]);

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
      await fetchDevices();
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
      await fetchDevices();
    } catch (error: unknown) {
      showAlert('error', 'Sync failed', getErrorMessage(error));
    } finally {
      setSyncingDeviceId(null);
    }
  };

  return (
    <>
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
            void fetchDevices();
          }}
          onError={(message) => showAlert('error', 'Mapping', message)}
        />
      )}

      <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-dark-gray">Sync users</h2>
          <p className="text-sm text-gray-500 mt-1">
            Pull users and punches from registered tablets. Register devices and get the API key in{' '}
            <Link href="/settings" className="text-primary font-medium hover:underline">
              Settings → Tablet setup
            </Link>
            .
          </p>
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

        {loading ? (
          <p className="text-sm text-gray-500">Loading devices…</p>
        ) : !deviceSetup?.devices.length ? (
          <p className="text-sm text-gray-500">
            No devices registered yet. Add a device under{' '}
            <Link href="/settings" className="text-primary font-medium hover:underline">
              Settings → Tablet setup
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-light-gray">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">IP address</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Config ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Last sync</th>
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
          Sync pulls users and punches from the device. Unmapped punches stay pending until you map
          device users to members.
        </p>
      </div>
    </>
  );
}

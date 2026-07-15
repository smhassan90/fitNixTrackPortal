'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  confirmDeviceMappings,
  fetchMappingCandidates,
  type MappingCandidate,
  type MappingCandidatesResponse,
  type UnmappedMember,
} from '@/lib/deviceApi';
import { displayMemberId } from '@/lib/displayMemberId';
import { getErrorMessage } from '@/lib/errorHandler';

type RowState = {
  memberId: number | null;
  /** Exact-match rows require an explicit confirm checkbox. */
  confirmMatch: boolean;
  /** When true, show full member dropdown instead of read-only exact match. */
  useDropdown: boolean;
};

type DeviceUserMappingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  deviceId: number | string;
  deviceName?: string;
  onSuccess?: (result: {
    mapped: number;
    attendanceSynced: number;
    errors: string[];
  }) => void;
  onError?: (message: string) => void;
};

function buildInitialRows(candidates: MappingCandidate[]): Record<string, RowState> {
  const rows: Record<string, RowState> = {};
  for (const c of candidates) {
    const hasExact = c.matchType === 'exact' && c.suggestedMember != null && c.deviceUserName != null;
    rows[c.deviceUserId] = {
      memberId: hasExact ? c.suggestedMember!.id : null,
      confirmMatch: false,
      useDropdown: !hasExact,
    };
  }
  return rows;
}

function memberLabel(m: UnmappedMember): string {
  const idPart = displayMemberId(m);
  const bits = [idPart !== '—' ? `#${idPart} ${m.name}` : m.name];
  if (m.phone) bits.push(m.phone);
  else if (m.email) bits.push(m.email);
  return bits.join(' · ');
}

function MemberSearchSelect({
  value,
  options,
  disabled,
  onChange,
}: {
  value: number | null;
  options: UnmappedMember[];
  disabled?: boolean;
  onChange: (memberId: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((m) => m.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((m) => {
      const hay = `${displayMemberId(m)} ${m.name} ${m.email ?? ''} ${m.phone ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-[200px]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:bg-gray-50 disabled:text-gray-400"
      >
        <span className={selected ? 'text-dark-gray truncate' : 'text-gray-400 truncate'}>
          {selected ? memberLabel(selected) : 'Select member…'}
        </span>
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full min-w-[240px] bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name…"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto py-1">
            {value != null && (
              <li>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  Clear selection
                </button>
              </li>
            )}
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400">No members available</li>
            ) : (
              filtered.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-primary/10 ${
                      m.id === value ? 'bg-primary/10 text-primary font-medium' : 'text-dark-gray'
                    }`}
                    onClick={() => {
                      onChange(m.id);
                      setOpen(false);
                    }}
                  >
                    {memberLabel(m)}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function DeviceUserMappingModal({
  isOpen,
  onClose,
  deviceId,
  deviceName,
  onSuccess,
  onError,
}: DeviceUserMappingModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<MappingCandidatesResponse | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const candidates = await fetchMappingCandidates(deviceId);
      setData(candidates);
      setRows(buildInitialRows(candidates.unmappedDeviceUsers));
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      setLoadError(msg);
      setData(null);
      setRows({});
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    if (!isOpen) return;
    void load();
  }, [isOpen, load]);

  /** Members reserved by other rows (for exclusivity in dropdowns). */
  const reservedByOther = useCallback(
    (deviceUserId: string): Set<number> => {
      const reserved = new Set<number>();
      for (const [id, row] of Object.entries(rows)) {
        if (id === deviceUserId || row.memberId == null) continue;
        const candidate = data?.unmappedDeviceUsers.find((c) => c.deviceUserId === id);
        if (!candidate) continue;
        const isExact = candidate.matchType === 'exact' && !row.useDropdown;
        if (isExact && !row.confirmMatch) continue;
        reserved.add(row.memberId);
      }
      return reserved;
    },
    [rows, data]
  );

  const optionsForRow = useCallback(
    (deviceUserId: string, currentMemberId: number | null): UnmappedMember[] => {
      const members = data?.unmappedMembers ?? [];
      const reserved = reservedByOther(deviceUserId);
      const extras: UnmappedMember[] = [];

      // Keep currently selected member visible even if it was a suggested exact match
      // not present in unmappedMembers (shouldn't happen, but be safe).
      if (currentMemberId != null && !members.some((m) => m.id === currentMemberId)) {
        const candidate = data?.unmappedDeviceUsers.find((c) => c.deviceUserId === deviceUserId);
        if (candidate?.suggestedMember?.id === currentMemberId) {
          extras.push({
            id: candidate.suggestedMember.id,
            memberNumber: candidate.suggestedMember.memberNumber,
            legacyMemberId: candidate.suggestedMember.legacyMemberId,
            name: candidate.suggestedMember.name,
            email: null,
            phone: null,
          });
        }
      }

      return [...extras, ...members].filter(
        (m) => m.id === currentMemberId || !reserved.has(m.id)
      );
    },
    [data, reservedByOther]
  );

  const isRowReady = useCallback(
    (candidate: MappingCandidate, row: RowState | undefined): boolean => {
      if (!row || row.memberId == null) return false;
      const isExact = candidate.matchType === 'exact' && !row.useDropdown;
      if (isExact) return row.confirmMatch;
      return true;
    },
    []
  );

  const readyMappings = useMemo(() => {
    if (!data) return [];
    const mappings: Array<{ deviceUserId: string; memberId: number }> = [];
    const used = new Set<number>();
    for (const candidate of data.unmappedDeviceUsers) {
      const row = rows[candidate.deviceUserId];
      if (!isRowReady(candidate, row) || row.memberId == null) continue;
      if (used.has(row.memberId)) continue;
      used.add(row.memberId);
      mappings.push({ deviceUserId: candidate.deviceUserId, memberId: row.memberId });
    }
    return mappings;
  }, [data, rows, isRowReady]);

  const updateRow = (deviceUserId: string, patch: Partial<RowState>) => {
    setRows((prev) => ({
      ...prev,
      [deviceUserId]: { ...prev[deviceUserId], ...patch },
    }));
  };

  const handleConfirm = async () => {
    if (readyMappings.length === 0) return;
    try {
      setSubmitting(true);
      const result = await confirmDeviceMappings(deviceId, readyMappings);
      onSuccess?.({
        mapped: result.mapped,
        attendanceSynced: result.attendanceSynced,
        errors: result.errors,
      });
      await load();
    } catch (err: unknown) {
      onError?.(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const unmappedCount = data?.unmappedDeviceUsers.length ?? 0;
  const pendingCount = data?.pendingLogCount ?? 0;
  const mappedCount = data?.mappedCount ?? 0;
  const noMembersLeft = unmappedCount > 0 && (data?.unmappedMembers.length ?? 0) === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      <div
        className="absolute inset-0 bg-black opacity-50 pointer-events-auto"
        onClick={submitting ? undefined : onClose}
      />

      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] relative z-10 pointer-events-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-dark-gray">Map device users</h2>
            <p className="text-sm text-gray-500 mt-1">
              Link biometric device users to dashboard members
              {deviceName ? ` · ${deviceName}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            title="Close"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="text-gray-500 mt-4">Loading mapping candidates…</p>
            </div>
          ) : loadError ? (
            <div className="text-center py-12 space-y-4">
              <p className="text-red-600">{loadError}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-amber-100 text-amber-900">
                  {unmappedCount} unmapped device user{unmappedCount === 1 ? '' : 's'}
                </span>
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-orange/10 text-orange-dark">
                  {pendingCount} pending punch{pendingCount === 1 ? '' : 'es'}
                </span>
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-primary/10 text-primary">
                  {mappedCount} already mapped
                </span>
              </div>

              {unmappedCount === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-dark-gray font-medium">All device users are mapped.</p>
                  <p className="text-sm text-gray-500 mt-1">No action needed for this device.</p>
                </div>
              ) : noMembersLeft ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-center">
                  <p className="text-amber-900 font-medium">
                    No unmapped members left. Create members in the dashboard first.
                  </p>
                  <p className="text-sm text-amber-800 mt-1">
                    Device users are waiting, but every dashboard member is already linked on this device.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-light-gray">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">
                          Device user ID
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">
                          Device name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">
                          Pending
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">
                          Assign member
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {data?.unmappedDeviceUsers.map((candidate) => {
                        const row = rows[candidate.deviceUserId] ?? {
                          memberId: null,
                          confirmMatch: false,
                          useDropdown: true,
                        };
                        const isExact =
                          candidate.matchType === 'exact' &&
                          candidate.suggestedMember != null &&
                          !row.useDropdown;
                        const options = optionsForRow(candidate.deviceUserId, row.memberId);

                        return (
                          <tr key={candidate.deviceUserId} className="hover:bg-gray-50 align-top">
                            <td className="px-4 py-3 text-sm font-mono text-gray-700 whitespace-nowrap">
                              {candidate.deviceUserId}
                              {candidate.deviceBadgeId && (
                                <div className="text-xs text-gray-400 mt-0.5">
                                  Badge {candidate.deviceBadgeId}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-dark-gray">
                              {candidate.deviceUserName || (
                                <span className="text-gray-400 italic">Unknown</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {candidate.pendingLogCount > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange/10 text-orange-dark">
                                  {candidate.pendingLogCount} punch
                                  {candidate.pendingLogCount === 1 ? '' : 'es'}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isExact ? (
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-medium text-dark-gray">
                                      {candidate.suggestedMember!.name}
                                      {displayMemberId(candidate.suggestedMember!) !== '—' && (
                                        <span className="ml-1 text-xs font-normal text-gray-500">
                                          (ID: {displayMemberId(candidate.suggestedMember!)})
                                        </span>
                                      )}
                                    </span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                      Exact name match
                                    </span>
                                  </div>
                                  <label className="flex items-center gap-2 text-sm text-dark-gray cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={row.confirmMatch}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        // If confirming would conflict with another row, block it.
                                        if (
                                          checked &&
                                          row.memberId != null &&
                                          reservedByOther(candidate.deviceUserId).has(row.memberId)
                                        ) {
                                          onError?.(
                                            'That member is already selected on another row.'
                                          );
                                          return;
                                        }
                                        updateRow(candidate.deviceUserId, {
                                          confirmMatch: checked,
                                        });
                                      }}
                                      className="rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    Confirm this match
                                  </label>
                                  <button
                                    type="button"
                                    className="text-xs text-primary hover:underline"
                                    onClick={() =>
                                      updateRow(candidate.deviceUserId, {
                                        useDropdown: true,
                                        confirmMatch: false,
                                        memberId: null,
                                      })
                                    }
                                  >
                                    Change
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {candidate.matchType === 'exact' && row.useDropdown && (
                                    <button
                                      type="button"
                                      className="text-xs text-gray-500 hover:text-primary"
                                      onClick={() =>
                                        updateRow(candidate.deviceUserId, {
                                          useDropdown: false,
                                          confirmMatch: false,
                                          memberId: candidate.suggestedMember?.id ?? null,
                                        })
                                      }
                                    >
                                      Use exact match again
                                    </button>
                                  )}
                                  <MemberSearchSelect
                                    value={row.memberId}
                                    options={options}
                                    disabled={options.length === 0 && row.memberId == null}
                                    onChange={(memberId) =>
                                      updateRow(candidate.deviceUserId, {
                                        memberId,
                                        confirmMatch: false,
                                      })
                                    }
                                  />
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 p-6 border-t border-gray-200 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-dark-gray hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={submitting || loading || readyMappings.length === 0}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            {submitting
              ? 'Confirming…'
              : `Confirm mappings${readyMappings.length > 0 ? ` (${readyMappings.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

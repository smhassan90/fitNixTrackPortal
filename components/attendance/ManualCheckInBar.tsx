'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import MemberAvatar from '@/components/MemberAvatar';
import {
  manualCheckIn,
  searchMembersForAttendance,
  type AttendanceSearchMember,
} from '@/lib/attendanceApi';
import { displayMemberId } from '@/lib/displayMemberId';
import { getErrorMessage } from '@/lib/errorHandler';
import type { OverdueCheckinAlert } from '@/lib/overdueAlerts';

type ManualCheckInBarProps = {
  onSuccess?: (result: { message: string; member: AttendanceSearchMember }) => void;
  onError?: (message: string) => void;
  onOverdueAlerts?: (alerts: OverdueCheckinAlert[]) => void;
};

function memberOptionLabel(m: AttendanceSearchMember): string {
  const idPart = displayMemberId(m);
  const parts = [m.name];
  if (idPart !== '—') parts.push(`#${idPart}`);
  if (m.phone) parts.push(m.phone);
  return parts.join(' · ');
}

export default function ManualCheckInBar({ onSuccess, onError, onOverdueAlerts }: ManualCheckInBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AttendanceSearchMember[]>([]);
  const [selected, setSelected] = useState<AttendanceSearchMember | null>(null);
  const [searching, setSearching] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const rows = await searchMembersForAttendance(trimmed);
      setResults(rows);
      setOpen(true);
    } catch (err: unknown) {
      setResults([]);
      setSearchError(getErrorMessage(err));
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (selected) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected, runSearch]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selectMember = (member: AttendanceSearchMember) => {
    setSelected(member);
    setQuery(memberOptionLabel(member));
    setOpen(false);
    setResults([]);
    setSearchError(null);
  };

  const clearSelection = () => {
    setSelected(null);
    setQuery('');
    setResults([]);
    setSearchError(null);
    setOpen(false);
  };

  const handleCheckIn = async () => {
    if (!selected) {
      onError?.('Select a member before checking in.');
      return;
    }
    setCheckingIn(true);
    try {
      const result = await manualCheckIn(selected.id);
      if (result.overdueAlerts.length > 0) {
        onOverdueAlerts?.(result.overdueAlerts);
      }
      onSuccess?.({ message: result.message, member: selected });
      clearSelection();
    } catch (err: unknown) {
      onError?.(getErrorMessage(err));
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 shadow-sm">
      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-dark-gray">Manual check-in</h2>
          <p className="text-xs text-gray-500">
            Use when the attendance device is not responding.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div ref={rootRef} className="relative min-w-0 flex-1">
          <label htmlFor="manual-checkin-search" className="sr-only">
            Search member by ID, phone, or name
          </label>
          <div className="flex gap-2">
            {selected && (
              <MemberAvatar name={selected.name} photoUrl={selected.photoUrl} size="sm" />
            )}
            <input
              id="manual-checkin-search"
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (selected) setSelected(null);
              }}
              onFocus={() => {
                if (!selected && results.length > 0) setOpen(true);
              }}
              placeholder="Search by member ID, phone, or name…"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              autoComplete="off"
            />
            {selected && (
              <button
                type="button"
                onClick={clearSelection}
                className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                aria-label="Clear selected member"
              >
                Clear
              </button>
            )}
          </div>

          {searching && (
            <p className="mt-1 text-xs text-gray-500">Searching…</p>
          )}
          {searchError && (
            <p className="mt-1 text-xs text-red-600">{searchError}</p>
          )}

          {open && !selected && results.length > 0 && (
            <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {results.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-primary/10"
                    onClick={() => selectMember(m)}
                  >
                    <MemberAvatar name={m.name} photoUrl={m.photoUrl} size="sm" />
                    <span className="min-w-0 truncate text-dark-gray">{memberOptionLabel(m)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {open && !selected && !searching && query.trim() && results.length === 0 && !searchError && (
            <p className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 shadow-lg">
              No members found. Try a different ID, phone, or name.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => void handleCheckIn()}
          disabled={!selected || checkingIn}
          className="shrink-0 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:self-center"
        >
          {checkingIn ? 'Checking in…' : 'Manual check-in'}
        </button>
      </div>
    </div>
  );
}

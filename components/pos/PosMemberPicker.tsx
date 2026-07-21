'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { posErrorMessage, searchMembersForPos } from '@/lib/pos/posApi';

export type PosCheckoutMember = {
  id: number;
  name: string;
  memberNumber?: string;
  phone?: string;
};

type PosMemberPickerProps = {
  selectedId: number | null;
  selectedName: string;
  onSelect: (member: PosCheckoutMember | null) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export default function PosMemberPicker({
  selectedId,
  selectedName,
  onSelect,
  onError,
  disabled = false,
}: PosMemberPickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PosCheckoutMember[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  const clearSelection = () => {
    onSelect(null);
    setQuery('');
    setResults([]);
    setOpen(false);
    setHasSearched(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length < 1) {
        setResults([]);
        setSearching(false);
        setHasSearched(false);
        return;
      }

      const seq = ++requestSeq.current;
      setSearching(true);
      try {
        const rows = await searchMembersForPos(trimmed);
        if (seq !== requestSeq.current) return;
        setResults(rows);
        setHasSearched(true);
        setOpen(true);
        setActiveIndex(0);
      } catch (err: unknown) {
        if (seq !== requestSeq.current) return;
        setResults([]);
        setHasSearched(true);
        onError?.(posErrorMessage(err));
      } finally {
        if (seq === requestSeq.current) setSearching(false);
      }
    },
    [onError]
  );

  useEffect(() => {
    if (selectedId != null) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(query);
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selectedId, runSearch]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (member: PosCheckoutMember) => {
    onSelect(member);
    setQuery('');
    setResults([]);
    setOpen(false);
    setHasSearched(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const m = results[activeIndex];
      if (m) pick(m);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  if (selectedId != null && selectedName) {
    return (
      <div className="animate-[posMemberIn_220ms_ease-out]">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Member</p>
        <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 to-teal-50 px-3 py-2.5 shadow-sm transition-shadow duration-200">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white shadow-sm">
            {initials(selectedName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-dark-gray">{selectedName}</p>
            <p className="text-xs text-primary-dark">Linked to this sale</p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={clearSelection}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-white/80 hover:text-dark-gray disabled:opacity-50"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  const showDropdown = open && (searching || hasSearched || query.trim().length > 0);

  return (
    <div ref={rootRef} className="relative animate-[posMemberIn_220ms_ease-out]">
      <label htmlFor={`${listId}-input`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
        Member <span className="font-normal normal-case text-gray-400">(optional)</span>
      </label>
      <div
        className={`flex items-center gap-2 rounded-xl border bg-white px-3 py-2 shadow-sm transition duration-200 ${
          open ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <svg className="h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="search"
          autoComplete="off"
          disabled={disabled}
          value={query}
          placeholder="Search name, ID, or phone…"
          className="min-w-0 flex-1 bg-transparent text-sm text-dark-gray outline-none placeholder:text-gray-400"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          onFocus={() => {
            if (results.length > 0 || hasSearched) setOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        {searching ? (
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-label="Searching" />
        ) : query ? (
          <button
            type="button"
            className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            onClick={() => {
              setQuery('');
              setResults([]);
              setHasSearched(false);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>

      {showDropdown && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1.5 origin-top overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg animate-[posMemberDrop_180ms_ease-out]"
        >
          {searching && results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-gray-500">Searching members…</p>
          ) : results.length === 0 && hasSearched ? (
            <p className="px-3 py-3 text-sm text-gray-500">No members found. Sale can continue as walk-in.</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-gray-500">Type to find a member</p>
          ) : (
            <ul className="max-h-52 overflow-y-auto overscroll-contain py-1">
              {results.map((m, index) => {
                const active = index === activeIndex;
                return (
                  <li key={m.id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                        active ? 'bg-primary/10' : 'hover:bg-gray-50'
                      }`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => pick(m)}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          active ? 'bg-primary text-white' : 'bg-light-gray text-dark-gray'
                        }`}
                      >
                        {initials(m.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-dark-gray">{m.name}</p>
                        {m.memberNumber ? (
                          <p className="truncate text-xs text-gray-500">ID {m.memberNumber}</p>
                        ) : (
                          <p className="text-xs text-gray-400">No member ID</p>
                        )}
                      </div>
                      <span className={`text-xs font-medium transition ${active ? 'text-primary opacity-100' : 'text-primary opacity-0'}`}>
                        Select
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes posMemberIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes posMemberDrop {
          from {
            opacity: 0;
            transform: translateY(-6px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

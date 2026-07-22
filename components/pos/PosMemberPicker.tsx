'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import MemberAvatar from '@/components/MemberAvatar';
import { posErrorMessage, searchMembersForPos, type PosMemberSearchHit } from '@/lib/pos/posApi';

export type PosCheckoutMember = PosMemberSearchHit;

type PosMemberPickerProps = {
  selectedId: number | null;
  selectedName: string;
  selectedPhone?: string | null;
  selectedMemberNumber?: string | null;
  onSelect: (member: PosCheckoutMember | null) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
};

function highlightMatch(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q || !text) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-primary/20 px-0.5 font-semibold text-dark-gray not-italic">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function PosMemberPicker({
  selectedId,
  selectedName,
  selectedPhone = null,
  selectedMemberNumber = null,
  onSelect,
  onError,
  disabled = false,
}: PosMemberPickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PosCheckoutMember[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const clearSelection = () => {
    onSelect(null);
    setSelectedPhoto(null);
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
    }, 220);
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

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const pick = (member: PosCheckoutMember) => {
    onSelect(member);
    setSelectedPhoto(member.photoUrl ?? null);
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
      <div className="pos-member-anim">
        <div className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/12 via-white to-teal-50/80 shadow-sm">
          <div className="flex items-center gap-2 border-b border-primary/10 bg-primary/5 px-3 py-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              ✓
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary-dark">
              Member linked
            </p>
          </div>
          <div className="flex items-center gap-3 px-3 py-3">
            <MemberAvatar
              name={selectedName}
              photoUrl={selectedPhoto}
              size="lg"
              enlargeOnClick={false}
              className="ring-2 ring-white shadow-sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-dark-gray">{selectedName}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {selectedMemberNumber ? (
                  <span className="inline-flex rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-medium text-dark-gray ring-1 ring-gray-200">
                    ID {selectedMemberNumber}
                  </span>
                ) : null}
                {selectedPhone ? (
                  <span className="inline-flex truncate rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] text-gray-600 ring-1 ring-gray-200">
                    {selectedPhone}
                  </span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={clearSelection}
              className="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-dark-gray shadow-sm transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
            >
              Change
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showDropdown = open && (searching || hasSearched || query.trim().length > 0);
  const hintChips = ['Name', 'Member ID', 'Phone'];

  return (
    <div ref={rootRef} className="relative pos-member-anim">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gradient-to-r from-slate-50 to-teal-50/40 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-dark-gray">Link a member</p>
              <p className="text-[11px] text-gray-500">Optional — leave empty for walk-in</p>
            </div>
            <span className="hidden rounded-full bg-white px-2 py-1 text-[10px] font-medium text-gray-500 ring-1 ring-gray-200 sm:inline">
              Esc to close
            </span>
          </div>
        </div>

        <div className="p-3">
          <div
            className={`flex items-center gap-2.5 rounded-xl border bg-slate-50/80 px-3 py-2.5 transition duration-200 ${
              open
                ? 'border-primary bg-white shadow-[0_0_0_3px_rgba(26,188,156,0.15)]'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <svg
              className="h-5 w-5 shrink-0 text-primary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
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
              placeholder="Search by name, ID, or phone…"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-dark-gray outline-none placeholder:font-normal placeholder:text-gray-400"
              role="combobox"
              aria-expanded={showDropdown}
              aria-controls={listId}
              aria-autocomplete="list"
              onFocus={() => {
                if (results.length > 0 || hasSearched || query.trim()) setOpen(true);
              }}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onKeyDown={onKeyDown}
            />
            {searching ? (
              <span
                className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
                aria-label="Searching"
              />
            ) : query ? (
              <button
                type="button"
                className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
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

          {!query.trim() && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {hintChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500"
                >
                  {chip}
                </span>
              ))}
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-primary-dark">
                ↑↓ navigate · Enter select
              </span>
            </div>
          )}
        </div>
      </div>

      {showDropdown && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl pos-member-drop"
        >
          <div className="flex items-center justify-between border-b border-gray-100 bg-slate-50/90 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              {searching && results.length === 0
                ? 'Searching…'
                : results.length > 0
                  ? `${results.length} match${results.length === 1 ? '' : 'es'}`
                  : 'Results'}
            </p>
            {results.length > 0 ? (
              <p className="text-[11px] text-gray-400">Click or press Enter</p>
            ) : null}
          </div>

          {searching && results.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-5">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              <div>
                <p className="text-sm font-medium text-dark-gray">Looking up members</p>
                <p className="text-xs text-gray-500">Matching name, ID, and phone…</p>
              </div>
            </div>
          ) : results.length === 0 && hasSearched ? (
            <div className="px-4 py-5 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-lg text-gray-400">
                ⌕
              </div>
              <p className="text-sm font-medium text-dark-gray">No members found</p>
              <p className="mt-1 text-xs text-gray-500">
                Try another spelling, or continue as walk-in.
              </p>
            </div>
          ) : results.length === 0 ? (
            <p className="px-4 py-4 text-sm text-gray-500">Start typing to find a member</p>
          ) : (
            <ul ref={listRef} className="max-h-64 overflow-y-auto overscroll-contain py-1">
              {results.map((m, index) => {
                const active = index === activeIndex;
                return (
                  <li key={m.id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      data-index={index}
                      className={`group flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                        active ? 'bg-primary/10' : 'hover:bg-slate-50'
                      }`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => pick(m)}
                    >
                      <MemberAvatar
                        name={m.name}
                        photoUrl={m.photoUrl}
                        size="md"
                        enlargeOnClick={false}
                        className={active ? 'ring-2 ring-primary/40' : ''}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-dark-gray">
                          {highlightMatch(m.name, query)}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                          {m.memberNumber ? (
                            <span>ID {highlightMatch(m.memberNumber, query)}</span>
                          ) : (
                            <span className="text-gray-400">No ID</span>
                          )}
                          {m.phone ? (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className="truncate">{highlightMatch(m.phone, query)}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                          active
                            ? 'bg-primary text-white opacity-100'
                            : 'bg-gray-100 text-gray-500 opacity-0 group-hover:opacity-100'
                        }`}
                      >
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
        .pos-member-anim {
          animation: posMemberIn 220ms ease-out;
        }
        .pos-member-drop {
          animation: posMemberDrop 180ms ease-out;
        }
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

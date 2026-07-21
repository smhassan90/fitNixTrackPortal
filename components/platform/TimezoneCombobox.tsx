'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type TimezoneComboboxProps = {
  value: string;
  onChange: (timezone: string) => void;
  options: string[];
  disabled?: boolean;
  required?: boolean;
  id?: string;
  placeholder?: string;
  loading?: boolean;
};

export default function TimezoneCombobox({
  value,
  onChange,
  options,
  disabled = false,
  required = false,
  id = 'timezone-combobox',
  placeholder = 'Search or pick a timezone…',
  loading = false,
}: TimezoneComboboxProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...options].sort((a, b) => a.localeCompare(b));
    if (!q) return sorted;
    return sorted.filter((tz) => tz.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!open || !value || !listRef.current) return;
    const selected = listRef.current.querySelector('[data-selected="true"]');
    selected?.scrollIntoView({ block: 'nearest' });
  }, [open, value, filtered.length]);

  const selectTimezone = (tz: string) => {
    onChange(tz);
    setQuery(tz);
    setOpen(false);
  };

  const openList = () => {
    if (!disabled && !loading && options.length > 0) setOpen(true);
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value.trim()) onChange('');
          }}
          onFocus={openList}
          disabled={disabled || (loading && options.length === 0)}
          required={required}
          placeholder={loading && options.length === 0 ? 'Loading timezones…' : placeholder}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm bg-white disabled:opacity-50"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
        />
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openList())}
          disabled={disabled || (loading && options.length === 0) || options.length === 0}
          className="shrink-0 rounded-lg border px-3 py-2 text-sm text-dark-gray hover:bg-gray-50 disabled:opacity-50"
          aria-label={open ? 'Close timezone list' : 'Open timezone list'}
        >
          <svg
            className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {!loading && options.length > 0 && (
        <p className="mt-1 text-xs text-dark-gray-light">
          {open
            ? `${filtered.length} timezone${filtered.length === 1 ? '' : 's'} — click to select`
            : `${options.length} timezones available — click the arrow or type to filter`}
        </p>
      )}

      {open && !disabled && !loading && filtered.length > 0 && (
        <ul
          id={`${id}-listbox`}
          ref={listRef}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {filtered.map((tz) => (
            <li key={tz} role="option" aria-selected={tz === value} data-selected={tz === value ? 'true' : undefined}>
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-sm hover:bg-primary/10 ${
                  tz === value ? 'bg-primary/5 font-medium text-primary' : 'text-dark-gray'
                }`}
                onClick={() => selectTimezone(tz)}
              >
                {tz}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !disabled && !loading && options.length > 0 && query.trim() && filtered.length === 0 && (
        <p className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 shadow-lg">
          No matching timezone. Try a different search or pick from the full list.
        </p>
      )}

      {open && !disabled && !loading && options.length === 0 && (
        <p className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 shadow-lg">
          No timezones loaded.
        </p>
      )}
    </div>
  );
}

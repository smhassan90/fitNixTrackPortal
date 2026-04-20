'use client';

import { useState } from 'react';
import { uploadPlatformGymLogo } from '@/lib/platform/uploadLogo';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';

interface Props {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  /** Show optional “paste URL” field (still validated as http/https). */
  showUrlFallback?: boolean;
  onBusyChange?: (busy: boolean) => void;
}

export default function PlatformLogoUpload({
  value,
  onChange,
  disabled,
  showUrlFallback = true,
  onBusyChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setBusyTracked = (v: boolean) => {
    setBusy(v);
    onBusyChange?.(v);
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || disabled) return;
    setErr(null);
    setBusyTracked(true);
    try {
      const url = await uploadPlatformGymLogo(f);
      onChange(url);
    } catch (ex) {
      setErr(mapPlatformErrorToUserMessage(ex));
    } finally {
      setBusyTracked(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-dark-gray">Logo</label>
        <p className="text-xs text-dark-gray-light mt-0.5">
          Upload a square-ish image (PNG, JPEG, WebP, or GIF, up to 2&nbsp;MB). We host it for you and attach it to
          the gym profile automatically.
        </p>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={onPick}
          disabled={disabled || busy}
          className="mt-2 block w-full text-sm text-dark-gray file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-white file:text-sm"
        />
        {busy && <p className="text-xs text-primary mt-1">Uploading…</p>}
        {err && <p className="text-xs text-error mt-1">{err}</p>}
      </div>

      {value ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-light-gray-dark bg-light-gray-light p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Logo preview" className="h-16 w-16 object-contain bg-white border rounded" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-dark-gray-light break-all">{value}</p>
            <button
              type="button"
              className="mt-2 text-sm text-error hover:underline"
              onClick={() => onChange('')}
              disabled={disabled || busy}
            >
              Remove logo
            </button>
          </div>
        </div>
      ) : null}

      {showUrlFallback ? (
        <div>
          <label className="block text-xs font-medium text-dark-gray-light">Or paste a link to an image</label>
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || busy}
            placeholder="https://…"
            className="mt-1 w-full rounded-lg border border-light-gray-dark px-3 py-2 text-sm"
          />
        </div>
      ) : null}
    </div>
  );
}

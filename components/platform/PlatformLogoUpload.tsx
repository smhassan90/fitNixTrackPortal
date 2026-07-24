'use client';

import { useEffect, useState } from 'react';
import MemberPhotoCropModal from '@/components/MemberPhotoCropModal';
import { uploadPlatformGymLogo } from '@/lib/platform/uploadLogo';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';

/** Sidebar / brand mark size — square logos display cleanly at this ratio. */
export const GYM_LOGO_SIDE_PX = 512;

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
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const setBusyTracked = (v: boolean) => {
    setBusy(v);
    onBusyChange?.(v);
  };

  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  const clearCrop = () => {
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setErr(null);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || disabled) return;
    setErr(null);
    if (!f.type.startsWith('image/')) {
      setErr('Please choose a PNG, JPEG, WebP, or GIF image.');
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      setErr('Image must be 2 MB or smaller before cropping.');
      return;
    }
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  };

  const onCropConfirm = async (blob: Blob) => {
    setBusyTracked(true);
    setErr(null);
    try {
      const file = new File([blob], `gym-logo-${Date.now()}.png`, { type: 'image/png' });
      const url = await uploadPlatformGymLogo(file);
      onChange(url);
      clearCrop();
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
          Upload a logo, then crop to a <strong>square</strong> (recommended {GYM_LOGO_SIDE_PX}&times;
          {GYM_LOGO_SIDE_PX}). This size is used in the gym portal sidebar. PNG, JPEG, WebP, or GIF up to
          2&nbsp;MB.
        </p>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={onPick}
          disabled={disabled || busy}
          className="mt-2 block w-full text-sm text-dark-gray file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-ink file:text-sm file:font-semibold"
        />
        {busy && <p className="text-xs text-primary mt-1">Uploading cropped logo…</p>}
        {err && !cropSrc && <p className="text-xs text-error mt-1">{err}</p>}
      </div>

      {value ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-light-gray-dark bg-ink p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Logo preview"
            className="h-14 w-14 rounded-xl object-contain bg-surface ring-1 ring-white/15"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white/80">Sidebar preview (dark background)</p>
            <p className="mt-1 text-[11px] text-white/40 break-all">{value}</p>
            <button
              type="button"
              className="mt-2 text-sm text-error-light hover:underline"
              onClick={() => onChange('')}
              disabled={disabled || busy}
            >
              Remove logo
            </button>
          </div>
        </div>
      ) : null}

      {showUrlFallback && (
        <div>
          <label className="block text-xs font-medium text-dark-gray-light">Or paste image URL</label>
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value.trim())}
            disabled={disabled || busy}
            placeholder="https://…"
            className="mt-1 w-full rounded-lg border border-light-gray-dark px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-dark-gray-light">
            Prefer upload + crop so the logo stays square for the sidebar.
          </p>
        </div>
      )}

      {cropSrc && (
        <MemberPhotoCropModal
          open
          imageSrc={cropSrc}
          busy={busy}
          submitError={err}
          title="Crop gym logo"
          description="Frame the logo in the square. It will appear in the gym portal sidebar at this aspect ratio."
          confirmLabel="Upload logo"
          cropShape="rect"
          exportOptions={{ mimeType: 'image/png', maxSize: GYM_LOGO_SIDE_PX, quality: 0.92 }}
          previewClassName="h-12 w-12 rounded-xl border border-gray-200 object-contain bg-gray-900"
          onCancel={clearCrop}
          onConfirm={(blob) => void onCropConfirm(blob)}
        />
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { memberInitials, resolveMemberPhotoUrl } from '@/lib/memberPhoto';

const SIZE_CLASS = {
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-12 w-12 text-sm',
} as const;

const SPINNER_CLASS = {
  sm: 'h-3 w-3 border',
  md: 'h-3.5 w-3.5 border-2',
  lg: 'h-4 w-4 border-2',
} as const;

type Props = {
  name: string;
  photoUrl?: string | null;
  size?: keyof typeof SIZE_CLASS;
  /** When true, clicking a loaded photo opens an enlarge overlay. Default true. */
  enlargeOnClick?: boolean;
  className?: string;
};

export default function MemberAvatar({
  name,
  photoUrl,
  size = 'md',
  enlargeOnClick = true,
  className = '',
}: Props) {
  const resolved = resolveMemberPhotoUrl(photoUrl);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [enlarged, setEnlarged] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [resolved]);

  const showImage = Boolean(resolved) && !failed;

  return (
    <>
      <div
        className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary ${SIZE_CLASS[size]} ${className}`}
      >
        {showImage && !loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/10" aria-hidden>
            <div
              className={`${SPINNER_CLASS[size]} animate-spin rounded-full border-primary/25 border-t-primary`}
            />
          </div>
        )}
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolved!}
            alt=""
            decoding="async"
            className={`h-full w-full object-cover transition-opacity ${
              loaded ? 'opacity-100' : 'opacity-0'
            } ${enlargeOnClick && loaded ? 'cursor-pointer hover:opacity-90' : ''}`}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            onClick={
              enlargeOnClick && loaded
                ? (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEnlarged(true);
                  }
                : undefined
            }
            title={enlargeOnClick && loaded ? 'Click to enlarge' : undefined}
          />
        ) : (
          <span aria-hidden>{memberInitials(name)}</span>
        )}
      </div>

      {enlarged && resolved && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${name} photo`}
        >
          <div className="absolute inset-0 bg-black/70" onClick={() => setEnlarged(false)} />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setEnlarged(false)}
              className="absolute -right-1 -top-1 flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-semibold text-dark-gray shadow-md hover:bg-gray-100 sm:-right-2 sm:-top-2"
              aria-label="Close photo"
            >
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolved}
              alt={name}
              className="max-h-[80vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
            />
            <p className="text-center text-sm font-medium text-white">{name}</p>
          </div>
        </div>
      )}
    </>
  );
}

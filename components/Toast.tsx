'use client';

import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

type ToastProps = {
  isOpen: boolean;
  onClose: () => void;
  type?: ToastType;
  message: string;
  title?: string;
  /** Auto-hide after ms. Default 3200. Set 0 to keep until closed. */
  duration?: number;
};

const typeStyles: Record<ToastType, { border: string; iconBg: string }> = {
  success: { border: 'border-emerald-200', iconBg: 'bg-emerald-500' },
  error: { border: 'border-red-200', iconBg: 'bg-red-500' },
  warning: { border: 'border-amber-200', iconBg: 'bg-amber-500' },
  info: { border: 'border-sky-200', iconBg: 'bg-sky-500' },
};

export default function Toast({
  isOpen,
  onClose,
  type = 'info',
  message,
  title,
  duration = 3200,
}: ToastProps) {
  useEffect(() => {
    if (!isOpen || duration <= 0) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [isOpen, duration, onClose, message, type]);

  if (!isOpen) return null;

  const styles = typeStyles[type];

  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-[200] w-[min(100%-2rem,22rem)]"
      role="status"
      aria-live="polite"
    >
      <div
        className={`rounded-xl border ${styles.border} bg-white px-4 py-3 shadow-lg`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${styles.iconBg}`}
          >
            {type === 'success' ? (
              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : type === 'error' ? (
              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01" />
              </svg>
            )}
          </span>
          <div className="min-w-0 flex-1">
            {title ? <p className="text-sm font-semibold text-dark-gray">{title}</p> : null}
            <p className={`text-sm text-gray-700 ${title ? 'mt-0.5' : ''}`}>{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

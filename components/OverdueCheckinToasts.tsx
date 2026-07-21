'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  formatOverdueDate,
  overdueAlertKey,
  type OverdueCheckinAlert,
} from '@/lib/overdueAlerts';
import OverdueWhatsAppButton from '@/components/OverdueWhatsAppButton';
import { displayMemberId } from '@/lib/displayMemberId';
import { normalizeWhatsAppPhone } from '@/lib/whatsappOverdue';

const AUTO_DISMISS_MS = 8000;
const MAX_VISIBLE_TOASTS = 4;

interface ToastItem {
  key: string;
  alert: OverdueCheckinAlert;
}

/**
 * Owns the overdue check-in toast queue with session-level dedupe
 * ("memberId|checkInTime"), so the same alert arriving from both the device
 * sync response and background polling is only shown once.
 */
export function useOverdueCheckinToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  const pushAlerts = useCallback(
    (alerts: OverdueCheckinAlert[], options?: { silent?: boolean }) => {
      const fresh: ToastItem[] = [];
      for (const alert of alerts) {
        const key = overdueAlertKey(alert);
        if (seenRef.current.has(key)) continue;
        seenRef.current.add(key);
        fresh.push({ key, alert });
      }
      if (!options?.silent && fresh.length > 0) {
        setToasts((prev) => [...prev, ...fresh]);
      }
    },
    []
  );

  const dismissToast = useCallback((key: string) => {
    setToasts((prev) => prev.filter((t) => t.key !== key));
  }, []);

  return { toasts, pushAlerts, dismissToast };
}

function ToastCard({
  alert,
  onDismiss,
  onOpen,
}: {
  alert: OverdueCheckinAlert;
  onDismiss: () => void;
  onOpen: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const idText = displayMemberId(alert);
  const whatsAppPhone = normalizeWhatsAppPhone(alert.contact);

  return (
    <div
      role="alert"
      onClick={onOpen}
      className="pointer-events-auto w-full cursor-pointer rounded-xl border border-red-200 bg-red-50 p-4 shadow-lg transition hover:border-red-300 hover:shadow-xl"
    >
      <div className="flex items-start gap-3">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-red-900">
            Overdue payment — {alert.memberName}
            {idText !== '—' ? ` (ID: ${idText})` : ''} just checked in.
          </p>
          <p className="mt-1 text-xs text-red-800">
            Rs. {alert.overdueAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })} overdue (
            {alert.overdueCount} installment{alert.overdueCount === 1 ? '' : 's'}
            {alert.overdueSince ? `, due since ${formatOverdueDate(alert.overdueSince)}` : ''}).
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-red-700 underline">View payments</span>
            {whatsAppPhone ? (
              <span onClick={(e) => e.stopPropagation()}>
                <OverdueWhatsAppButton alert={alert} variant="pill" />
              </span>
            ) : (
              <span className="text-[10px] text-red-600/80">No phone on file</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="shrink-0 rounded-lg p-1 text-red-400 transition hover:bg-red-100 hover:text-red-700"
          aria-label="Dismiss notification"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function OverdueCheckinToasts({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (key: string) => void;
}) {
  const router = useRouter();

  if (toasts.length === 0) return null;

  const visible = toasts.slice(0, MAX_VISIBLE_TOASTS);
  const overflowMembers = new Set(
    toasts.slice(MAX_VISIBLE_TOASTS).map((t) => t.alert.memberId)
  ).size;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 sm:right-6 sm:top-6">
      {visible.map((toast) => (
        <ToastCard
          key={toast.key}
          alert={toast.alert}
          onDismiss={() => onDismiss(toast.key)}
          onOpen={() => {
            onDismiss(toast.key);
            router.push(`/payments/members/${toast.alert.memberId}`);
          }}
        />
      ))}
      {overflowMembers > 0 && (
        <div className="pointer-events-auto rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-medium text-red-800 shadow-lg">
          and {overflowMembers} more member{overflowMembers === 1 ? '' : 's'} with overdue payments
        </div>
      )}
    </div>
  );
}

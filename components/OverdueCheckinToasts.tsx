'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  formatOverdueDate,
  overdueAlertKey,
  type OverdueCheckinAlert,
} from '@/lib/overdueAlerts';
import { displayMemberId } from '@/lib/displayMemberId';
import { normalizeWhatsAppPhone, openWhatsAppOverdueChat } from '@/lib/whatsappOverdue';

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
  gymName,
  adminName,
  onDismiss,
  onOpen,
}: {
  alert: OverdueCheckinAlert;
  gymName: string;
  adminName: string;
  onDismiss: () => void;
  onOpen: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const idText = displayMemberId(alert);
  const whatsAppPhone = normalizeWhatsAppPhone(alert.contact);

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!whatsAppPhone) return;
    openWhatsAppOverdueChat({
      alert,
      gymName,
      adminName,
      gender: alert.gender,
    });
  };

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
              <button
                type="button"
                onClick={handleWhatsApp}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#1ebe57]"
                title="Send overdue reminder via WhatsApp"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </button>
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
  const { user } = useAuth();
  const gymName = user?.gymName ?? 'Your Gym';
  const adminName = user?.name ?? 'Gym Admin';

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
          gymName={gymName}
          adminName={adminName}
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

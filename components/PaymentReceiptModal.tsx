'use client';

import { useEffect, useRef, useState } from 'react';
import { formatDate } from '@/lib/dateUtils';
import {
  buildPaymentReceiptHtml,
  fetchOneTimePaymentReceiptData,
  fetchPaymentReceiptData,
  openPaymentReceiptPrintWindow,
  resolveReceiptPaymentAmount,
  sharePaymentReceiptOnWhatsApp,
  type PaymentReceiptData,
  type PaymentReceiptPrintedBy,
  type ReceiptEnrichmentHints,
} from '@/lib/paymentReceipt';
import { normalizeWhatsAppPhone } from '@/lib/whatsappOverdue';

export type PaymentReceiptTarget = {
  kind: 'monthly' | 'one-time';
  id: string | number;
  memberId?: string | number;
  fallbackPhone?: string | null;
  printedBy?: PaymentReceiptPrintedBy | null;
  hints?: ReceiptEnrichmentHints | null;
  /** Open the browser print dialog once after load. */
  autoPrint?: boolean;
};

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function formatMoney(amount: number): string {
  return `Rs. ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function PaymentReceiptModal({
  target,
  onClose,
  onError,
}: {
  target: PaymentReceiptTarget | null;
  onClose: () => void;
  onError?: (message: string) => void;
}) {
  const printedKey = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PaymentReceiptData | null>(null);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [showWhatsAppPhone, setShowWhatsAppPhone] = useState(false);
  const [whatsAppBusy, setWhatsAppBusy] = useState(false);

  const knownPhone = data?.member.phone || target?.fallbackPhone || null;
  const hasKnownPhone = Boolean(normalizeWhatsAppPhone(knownPhone));

  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  onCloseRef.current = onClose;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!target) {
      setData(null);
      setLoading(false);
      setPhoneDraft('');
      setShowWhatsAppPhone(false);
      printedKey.current = null;
      return;
    }

    let cancelled = false;
    setLoading(true);
    setData(null);
    setShowWhatsAppPhone(false);

    const load = async () => {
      try {
        const receipt =
          target.kind === 'one-time'
            ? await fetchOneTimePaymentReceiptData(
                target.id,
                target.printedBy,
                target.memberId,
                target.hints
              )
            : await fetchPaymentReceiptData(
                target.id,
                target.printedBy,
                target.memberId,
                target.hints
              );
        if (cancelled) return;
        setData(receipt);
        setPhoneDraft(receipt.member.phone || target.fallbackPhone || '');
      } catch (err: unknown) {
        if (cancelled) return;
        onErrorRef.current?.(err instanceof Error ? err.message : 'Could not load receipt.');
        onCloseRef.current();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [target]);

  useEffect(() => {
    if (!target?.autoPrint || !data || loading) return;
    const key = `${target.kind}:${target.id}`;
    if (printedKey.current === key) return;
    printedKey.current = key;
    const timer = window.setTimeout(() => {
      try {
        const win = openPaymentReceiptPrintWindow(buildPaymentReceiptHtml(data));
        if (!win) onErrorRef.current?.('Allow popups to print receipts.');
      } catch (err: unknown) {
        onErrorRef.current?.(err instanceof Error ? err.message : 'Could not open print dialog.');
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [target, data, loading]);

  if (!target) return null;

  const handlePrint = () => {
    if (!data) return;
    try {
      const win = openPaymentReceiptPrintWindow(buildPaymentReceiptHtml(data));
      if (!win) onError?.('Allow popups to print receipts.');
    } catch (err: unknown) {
      onError?.(err instanceof Error ? err.message : 'Could not open print dialog.');
    }
  };

  const sendWhatsApp = async (phone?: string | null) => {
    if (!data || whatsAppBusy) return;
    try {
      setWhatsAppBusy(true);
      const result = await sharePaymentReceiptOnWhatsApp(data, phone);
      if (result.downloadedFile) {
        onError?.(
          'Complete receipt downloaded. Attach that file in WhatsApp if it did not open in the share sheet.'
        );
      }
    } catch (err: unknown) {
      onError?.(err instanceof Error ? err.message : 'Could not share receipt on WhatsApp.');
    } finally {
      setWhatsAppBusy(false);
    }
  };

  const handleWhatsApp = () => {
    if (!data) return;
    if (hasKnownPhone) {
      void sendWhatsApp(knownPhone);
      return;
    }
    if (!showWhatsAppPhone) {
      setShowWhatsAppPhone(true);
      return;
    }
    const typed = phoneDraft.trim();
    if (typed && !normalizeWhatsAppPhone(typed)) {
      onError?.('Enter a valid phone number (e.g. 03xx or +92…).');
      return;
    }
    void sendWhatsApp(typed || null);
  };

  const amount = data ? resolveReceiptPaymentAmount(data) : 0;
  const subtitle =
    data?.receiptType === 'one-time' || data?.receiptType === 'signup-monthly'
      ? 'Membership signup'
      : data?.payment.month
        ? `Month ${data.payment.month}`
        : 'Payment receipt';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Payment recorded</p>
            <h2 className="text-lg font-bold text-dark-gray">
              {data ? `Receipt ${data.receiptNumber}` : 'Receipt'}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {data ? formatDate(data.payment.paidDate || data.generatedAt) : 'Loading…'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {loading || !data ? (
          <p className="mt-6 text-sm text-gray-500">Preparing receipt…</p>
        ) : (
          <>
            <p className="mt-3 text-sm text-gray-700">
              Member:{' '}
              <span className="font-medium text-dark-gray">{data.member.name || '—'}</span>
            </p>
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            {data.package?.name && (
              <p className="mt-1 text-sm text-gray-500">Package: {data.package.name}</p>
            )}
            <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <span className="text-sm text-gray-600">Amount paid</span>
              <span className="text-lg font-bold text-dark-gray">{formatMoney(amount)}</span>
            </div>

            {showWhatsAppPhone && !hasKnownPhone && (
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <label className="block text-xs font-medium text-gray-600">
                  WhatsApp number <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={phoneDraft}
                  onChange={(e) => setPhoneDraft(e.target.value)}
                  placeholder="03xx… or +92…"
                  className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-1.5 text-[11px] text-gray-500">
                  Leave blank to open WhatsApp and choose a contact. The complete printable receipt is shared or
                  downloaded with the message.
                </p>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
              >
                Print receipt
              </button>
              <button
                type="button"
                disabled={whatsAppBusy}
                onClick={handleWhatsApp}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
              >
                <WhatsAppIcon className="h-4 w-4" />
                {whatsAppBusy
                  ? 'Preparing…'
                  : showWhatsAppPhone && !hasKnownPhone
                    ? 'Send on WhatsApp'
                    : 'WhatsApp'}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-gray-500">
              WhatsApp includes the short message plus the complete receipt file (share sheet on phone, or download
              to attach on desktop).
            </p>
          </>
        )}
      </div>
    </div>
  );
}

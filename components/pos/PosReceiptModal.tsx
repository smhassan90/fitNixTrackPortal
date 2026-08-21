'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { PosSale } from '@/lib/pos/types';
import { formatMoney } from '@/lib/pos/utils';
import { formatDate } from '@/lib/dateUtils';
import { normalizeWhatsAppPhone } from '@/lib/whatsappOverdue';
import { sharePosReceiptOnWhatsApp, printPosReceipt } from '@/lib/pos/receipt';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function PosReceiptModal({
  sale,
  onClose,
  autoPrint = false,
  fallbackPhone,
  onPrintError,
}: {
  sale: PosSale | null;
  onClose: () => void;
  /** When true, open the print dialog once when the receipt appears (checkout). */
  autoPrint?: boolean;
  /** Phone captured from member picker when sale response omits it. */
  fallbackPhone?: string | null;
  onPrintError?: (message: string) => void;
}) {
  const { user } = useAuth();
  const printedForSale = useRef<number | null>(null);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [showWhatsAppPhone, setShowWhatsAppPhone] = useState(false);
  const [whatsAppBusy, setWhatsAppBusy] = useState(false);

  const gymName = user?.gymName ?? 'FitNix';
  const knownPhone = sale?.memberPhone || fallbackPhone || null;
  const hasKnownPhone = Boolean(normalizeWhatsAppPhone(knownPhone));

  useEffect(() => {
    if (!sale) {
      printedForSale.current = null;
      setPhoneDraft('');
      setShowWhatsAppPhone(false);
      return;
    }
    setPhoneDraft(knownPhone ?? '');
    setShowWhatsAppPhone(false);
  }, [sale, knownPhone]);

  useEffect(() => {
    if (!sale || !autoPrint) return;
    if (printedForSale.current === sale.id) return;
    printedForSale.current = sale.id;
    const timer = window.setTimeout(() => {
      try {
        printPosReceipt({ sale, gymName });
      } catch (err: unknown) {
        onPrintError?.(err instanceof Error ? err.message : 'Could not open print dialog.');
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [sale, autoPrint, gymName, onPrintError]);

  if (!sale) return null;

  const handlePrint = () => {
    try {
      printPosReceipt({ sale, gymName });
    } catch (err: unknown) {
      onPrintError?.(err instanceof Error ? err.message : 'Could not open print dialog.');
    }
  };

  const sendWhatsApp = async (phone?: string | null) => {
    if (whatsAppBusy) return;
    try {
      setWhatsAppBusy(true);
      const result = await sharePosReceiptOnWhatsApp({ sale, gymName }, phone);
      if (result.downloadedFile) {
        onPrintError?.(
          'Complete receipt downloaded. Attach that file in WhatsApp if it did not open in the share sheet.'
        );
      }
    } catch (err: unknown) {
      onPrintError?.(err instanceof Error ? err.message : 'Could not share receipt on WhatsApp.');
    } finally {
      setWhatsAppBusy(false);
    }
  };

  const handleWhatsApp = () => {
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
      onPrintError?.('Enter a valid phone number (e.g. 03xx or +92…).');
      return;
    }
    void sendWhatsApp(typed || null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Sale complete</p>
            <h2 className="text-lg font-bold text-dark-gray">Receipt {sale.receiptNo}</h2>
            <p className="mt-1 text-xs text-gray-500">{formatDate(sale.createdAt)}</p>
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

        {sale.memberName && (
          <p className="mt-3 text-sm text-gray-700">
            Member: <span className="font-medium text-dark-gray">{sale.memberName}</span>
          </p>
        )}

        <ul className="mt-4 divide-y divide-gray-100 border-y border-gray-100">
          {sale.items.map((line, i) => (
            <li key={i} className="flex justify-between gap-3 py-2 text-sm">
              <span>
                {line.productName ?? `Product #${line.productId}`} × {line.quantity}
              </span>
              <span className="shrink-0">{formatMoney(line.lineTotal)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatMoney(sale.subtotal)}</span>
          </div>
          {sale.discountTotal > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Discount</span>
              <span>-{formatMoney(sale.discountTotal)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-dark-gray">
            <span>Total</span>
            <span>{formatMoney(sale.total)}</span>
          </div>
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
              Leave blank to open WhatsApp and choose a contact.
            </p>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-dark-gray transition hover:bg-gray-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 9V3h12v6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 17H4a2 2 0 01-2-2v-4a2 2 0 012-2h16a2 2 0 012 2v4a2 2 0 01-2 2h-2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 13h12v8H6z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Print receipt
          </button>
          <button
            type="button"
            disabled={whatsAppBusy}
            onClick={handleWhatsApp}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1ebe57] disabled:opacity-50"
          >
            <WhatsAppIcon className="h-4 w-4" />
            {whatsAppBusy
              ? 'Preparing…'
              : showWhatsAppPhone && !hasKnownPhone
                ? 'Send on WhatsApp'
                : 'WhatsApp'}
          </button>
        </div>
        <p className="text-center text-[11px] text-gray-500">
          Shares the complete printable receipt file with the short WhatsApp message.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark active:bg-primary-dark"
        >
          Done
        </button>
      </div>
    </div>
  );
}

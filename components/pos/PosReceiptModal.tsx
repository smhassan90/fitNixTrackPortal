'use client';

import type { PosSale } from '@/lib/pos/types';
import { formatMoney } from '@/lib/pos/utils';
import { formatDate } from '@/lib/dateUtils';

export default function PosReceiptModal({
  sale,
  onClose,
}: {
  sale: PosSale | null;
  onClose: () => void;
}) {
  if (!sale) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-dark-gray">Receipt {sale.receiptNo}</h2>
        <p className="mt-1 text-xs text-gray-500">{formatDate(sale.createdAt)}</p>
        {sale.memberName && (
          <p className="mt-2 text-sm text-gray-700">Member: {sale.memberName}</p>
        )}
        <ul className="mt-4 divide-y divide-gray-100 border-y border-gray-100">
          {sale.items.map((line, i) => (
            <li key={i} className="flex justify-between py-2 text-sm">
              <span>
                {line.productName ?? `Product #${line.productId}`} × {line.quantity}
              </span>
              <span>{formatMoney(line.lineTotal)}</span>
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
        <button type="button" onClick={onClose} className="mt-5 w-full rounded-lg bg-primary py-2 text-sm font-medium text-white">
          Close
        </button>
      </div>
    </div>
  );
}

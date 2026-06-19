import {
  printOneTimePaymentReceipt,
  printPaymentReceipt,
  type PaymentReceiptPrintedBy,
} from '@/lib/paymentReceipt';

export interface PrintablePaymentRecord {
  type: string;
  id: number;
  receiptPath?: string | null;
}

/** Receipt API path for a payment row from member history or pending one-time. */
export function getReceiptUrl(payment: PrintablePaymentRecord): string {
  const path = payment.receiptPath?.trim();
  if (path) return path;
  if (payment.type === 'one-time') {
    return `/api/payments/one-time/${payment.id}/receipt`;
  }
  return `/api/payments/${payment.id}/receipt`;
}

export function isOneTimeReceipt(payment: PrintablePaymentRecord): boolean {
  if (payment.type === 'one-time') return true;
  const url = getReceiptUrl(payment);
  return url.includes('/one-time/');
}

export async function printReceiptForPaymentRecord(
  payment: PrintablePaymentRecord,
  printedBy?: PaymentReceiptPrintedBy | null,
  memberId?: string | number
): Promise<void> {
  if (isOneTimeReceipt(payment)) {
    await printOneTimePaymentReceipt(payment.id, printedBy, memberId);
    return;
  }
  await printPaymentReceipt(payment.id, printedBy, memberId);
}

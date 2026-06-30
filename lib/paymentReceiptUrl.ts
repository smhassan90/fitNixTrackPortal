import api from '@/lib/api';
import {
  printOneTimePaymentReceipt,
  printPaymentReceipt,
  type PaymentReceiptPrintedBy,
} from '@/lib/paymentReceipt';

export function receiptPrintedByFromUser(user: {
  name?: string | null;
  email?: string | null;
  role?: string | null;
} | null | undefined): PaymentReceiptPrintedBy {
  return {
    name: user?.name || user?.email || 'Staff',
    email: user?.email ?? null,
    role: user?.role ?? null,
  };
}

/** Resolve payment id after mark-paid (projected rows get a real id only once persisted). */
export async function resolvePaymentIdAfterMarkPaid(params: {
  memberId: string | number;
  month: string;
  existingId?: string | number | null;
  wasProjected?: boolean;
}): Promise<string | number | null> {
  if (!params.wasProjected && params.existingId != null && String(params.existingId).trim() !== '') {
    return params.existingId;
  }
  const response = await api.get(`/api/members/${params.memberId}/payments?type=all`);
  const timeline = (response.data?.data?.monthlyInstallments || []) as Record<string, unknown>[];
  const row = timeline.find(
    (r) => String(r.month) === params.month && String(r.status).toUpperCase() === 'PAID'
  );
  const id = row?.id;
  return id != null && String(id).trim() !== '' ? id : null;
}

export async function tryPrintMonthlyReceiptAfterMarkPaid(params: {
  paymentId: string | number;
  memberId?: string | number;
  printedBy?: PaymentReceiptPrintedBy | null;
}): Promise<void> {
  try {
    await printPaymentReceipt(params.paymentId, params.printedBy, params.memberId);
  } catch (err) {
    console.warn('Receipt print failed:', err);
    throw err;
  }
}

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

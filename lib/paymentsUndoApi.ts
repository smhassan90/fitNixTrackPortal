import api from '@/lib/api';

function assertUndoSuccess(
  response: { data?: { success?: boolean; error?: { message?: string } } },
  fallback: string
): void {
  if (response.data?.success) return;
  throw new Error(response.data?.error?.message || fallback);
}

/** PATCH /api/payments/:id/mark-unpaid — reverses monthly payment + fee_collection. */
export async function markMonthlyPaymentUnpaid(paymentId: string | number): Promise<void> {
  const response = await api.patch(`/api/payments/${paymentId}/mark-unpaid`);
  assertUndoSuccess(response, 'Could not mark installment unpaid');
}

/** PATCH /api/payments/one-time/:id/mark-unpaid — reverses signup + fee_collection (+ month-1 when allowed). */
export async function markOneTimePaymentUnpaid(oneTimePaymentId: string | number): Promise<void> {
  const response = await api.patch(`/api/payments/one-time/${oneTimePaymentId}/mark-unpaid`);
  assertUndoSuccess(response, 'Could not mark signup payment unpaid');
}

/** DELETE /api/payments/:id — also reverses fee_collection on backend. */
export async function deleteMonthlyPayment(paymentId: string | number): Promise<void> {
  const response = await api.delete(`/api/payments/${paymentId}`);
  assertUndoSuccess(response, 'Could not delete payment');
}

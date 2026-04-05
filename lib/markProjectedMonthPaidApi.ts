import api from '@/lib/api';

function isHttp404(e: unknown): boolean {
  const status = (e as { response?: { status?: number } }).response?.status;
  return status === 404;
}

/**
 * Projected advance rows have no payment id. Tries payment-hub routes first (same prefix as
 * bulk-mark-paid), then member-nested route — whichever the backend implements.
 */
export async function postMarkProjectedMonthPaid(params: {
  memberId: string;
  billingMonth: string;
  amount: number;
  dueDate: string;
}): Promise<void> {
  const body = {
    memberId: params.memberId,
    billingMonth: params.billingMonth,
    amount: params.amount,
    dueDate: params.dueDate,
  };

  const paths = [
    '/api/payments/mark-month-paid',
    `/api/members/${params.memberId}/payments/mark-month-paid`,
  ];

  let lastError: unknown;
  for (const path of paths) {
    try {
      const response = await api.post(path, body);
      if (response.data?.success) return;
      throw new Error(
        (response.data as { error?: { message?: string } })?.error?.message || 'Mark paid failed'
      );
    } catch (e: unknown) {
      if (isHttp404(e)) {
        lastError = e;
        continue;
      }
      throw e;
    }
  }

  const hint =
    'Add one of: POST /api/payments/mark-month-paid OR POST /api/members/:memberId/payments/mark-month-paid ' +
    `with JSON body ${JSON.stringify(body)}`;
  throw new Error(
    lastError
      ? `Route not found (404) for advance payment. ${hint}`
      : `Could not record advance payment. ${hint}`
  );
}

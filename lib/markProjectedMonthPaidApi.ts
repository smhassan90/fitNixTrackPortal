import api from '@/lib/api';

function isHttp404(e: unknown): boolean {
  const status = (e as { response?: { status?: number } }).response?.status;
  return status === 404;
}

/**
 * Marks a projected/advance billing month as paid via backend routes (same order as bulk-mark-paid).
 * Body shapes per API: POST /api/payments/mark-month-paid { memberId, month } and
 * POST /api/members/:id/payments/mark-month-paid { month }.
 */
export async function postMarkProjectedMonthPaid(params: {
  memberId: string;
  billingMonth: string;
  /** Kept for callers; not sent — server derives amount/dates from month + member. */
  amount?: number;
  dueDate?: string;
}): Promise<void> {
  const month = params.billingMonth;
  const bodyGlobal = { memberId: params.memberId, month };
  const bodyMember = { month };

  const paths = [
    { path: '/api/payments/mark-month-paid', body: bodyGlobal },
    { path: `/api/members/${params.memberId}/payments/mark-month-paid`, body: bodyMember },
  ];

  let lastError: unknown;
  for (const { path, body } of paths) {
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
    'Add one of: POST /api/payments/mark-month-paid { memberId, month } OR ' +
    `POST /api/members/:memberId/payments/mark-month-paid { month } (YYYY-MM). Example month: ${JSON.stringify(month)}`;
  throw new Error(
    lastError
      ? `Route not found (404) for mark-month-paid. ${hint}`
      : `Could not record payment. ${hint}`
  );
}

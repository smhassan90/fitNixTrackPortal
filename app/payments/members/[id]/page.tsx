'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import Alert from '@/components/Alert';
import Loading from '@/components/Loading';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/dateUtils';
import { useAlert } from '@/hooks/useAlert';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errorHandler';
import {
  isInstallmentUnpaid,
  uiBucketForInstallment,
  uiLabelForBucket,
  type InstallmentUiBucket,
} from '@/lib/monthlyInstallmentUi';

type InstallmentStatus = 'PENDING' | 'OVERDUE' | 'PAID' | string;

interface MonthlyInstallment {
  id: string;
  memberId?: string;
  month: string;
  amount: number;
  status: InstallmentStatus;
  dueDate: string;
  paidDate: string | null;
  /** Server-computed using GYM_TIMEZONE; prefer over client inference. */
  displayBucket?: string | null;
  member?: { id: string; name: string; phone: string | null; email: string | null };
}

function normalizeInstallment(raw: Record<string, unknown>): MonthlyInstallment {
  const m = raw.member as MonthlyInstallment['member'] | undefined;
  return {
    ...raw,
    id: String(raw.id ?? ''),
    memberId: raw.memberId != null ? String(raw.memberId) : undefined,
    amount: Number(raw.amount) || 0,
    status: String(raw.status ?? ''),
    dueDate: String(raw.dueDate ?? ''),
    month: String(raw.month ?? ''),
    displayBucket: raw.displayBucket != null ? String(raw.displayBucket) : undefined,
    paidDate: raw.paidDate != null ? String(raw.paidDate) : null,
    member: m
      ? {
          ...m,
          id: String(m.id),
        }
      : m,
  } as MonthlyInstallment;
}

function sortByDueDate(a: MonthlyInstallment, b: MonthlyInstallment) {
  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
}

/** Enable via: dev build, NEXT_PUBLIC_DEBUG_MEMBER_PAYMENTS=true, or localStorage DEBUG_MEMBER_PAYMENTS=1 */
function shouldLogMemberPaymentsDebug(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_DEBUG_MEMBER_PAYMENTS === 'true' ||
    window.localStorage?.getItem('DEBUG_MEMBER_PAYMENTS') === '1'
  );
}

function ymFromMonthLabel(month: string): { y: number; m: number } | null {
  const m = month.trim().match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) };
}

function calendarMonthIndex(y: number, month1to12: number): number {
  return y * 12 + (month1to12 - 1);
}

const EXPECTED_MONTHLY_PAYMENTS_API_BEHAVIOR = `What the backend should do for this endpoint:
- GET /api/members/:memberId/payments?type=monthly must return data.monthlyInstallments[] that reflects the full open + paid schedule the gym needs to operate.
- For active monthly memberships: after the last PAID billing month, still return unpaid rows (status PENDING or OVERDUE) for each subsequent billing period up to "now" per GYM_TIMEZONE (dueDate, month label e.g. YYYY-MM, amount). Without those rows, the portal cannot show Overdue/Pending or mark the next month paid.
- Prefer setting displayBucket per row on the server (overdue/pending/advance/paid) using gym timezone so the UI matches your rules.
- If the portal uses bulk mark-paid with numeric paymentIds[], installment primary keys should be numeric (or the API should accept string IDs consistently).`;

/**
 * Console output for backend handoff: request, raw response, normalized rows, diagnosis, and a copy-paste prompt.
 */
function logMemberPaymentsTimelineDebug(opts: {
  memberId: string;
  requestPath: string;
  httpStatus: number;
  responseBody: unknown;
  normalized: MonthlyInstallment[];
}) {
  if (!shouldLogMemberPaymentsDebug()) return;

  const tag = '[FitNix Payments → BACKEND DEBUG]';
  const { memberId, requestPath, httpStatus, responseBody, normalized } = opts;

  const data = (responseBody as { data?: Record<string, unknown> })?.data ?? responseBody;
  const dataObj = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};

  const rowsSummary = normalized.map((r) => ({
    id: r.id,
    idIsNumeric: !Number.isNaN(Number(r.id)) && String(Number(r.id)) === String(r.id).trim(),
    month: r.month,
    amount: r.amount,
    status: r.status,
    dueDate: r.dueDate,
    paidDate: r.paidDate,
    displayBucket: r.displayBucket ?? '(missing — UI falls back to browser-local date rules)',
  }));

  const unpaid = normalized.filter((r) => r.status !== 'PAID');
  const paid = normalized.filter((r) => r.status === 'PAID');
  const paidWithMonth = paid
    .map((r) => ({ row: r, ym: ymFromMonthLabel(r.month) }))
    .filter((x): x is { row: MonthlyInstallment; ym: { y: number; m: number } } => x.ym !== null);
  let lastPaidYm: { y: number; m: number } | null = null;
  for (const { ym } of paidWithMonth) {
    if (!lastPaidYm || calendarMonthIndex(ym.y, ym.m) > calendarMonthIndex(lastPaidYm.y, lastPaidYm.m)) {
      lastPaidYm = ym;
    }
  }

  const today = new Date();
  const todayYm = { y: today.getFullYear(), m: today.getMonth() + 1 };
  const todayIdx = calendarMonthIndex(todayYm.y, todayYm.m);
  const lastPaidIdx = lastPaidYm ? calendarMonthIndex(lastPaidYm.y, lastPaidYm.m) : null;

  const memberNameFromPayload =
    (dataObj.member as { name?: string } | undefined)?.name ??
    dataObj.memberName ??
    normalized[0]?.member?.name ??
    '(not in payload)';

  let diagnosis: string;
  if (normalized.length === 0) {
    diagnosis =
      'ISSUE: Empty timeline. Backend returned no monthlyInstallments (or empty array). UI cannot show Overdue/Pending.';
  } else if (unpaid.length === 0 && lastPaidIdx !== null && lastPaidIdx < todayIdx) {
    diagnosis =
      `LIKELY BACKEND BUG: All ${normalized.length} row(s) are PAID through ${lastPaidYm!.y}-${String(lastPaidYm!.m).padStart(2, '0')}, but the current calendar month (browser) is ${todayYm.y}-${String(todayYm.m).padStart(2, '0')}. ` +
      'There are ZERO unpaid rows for later months — the portal correctly shows empty Overdue/Pending. Root cause is almost certainly installment generation/sync on GET or after mark-paid (not the React UI).';
  } else if (unpaid.length === 0 && lastPaidIdx !== null && lastPaidIdx >= todayIdx) {
    diagnosis =
      'All rows are PAID and the latest paid month is still the current or a future calendar month vs browser today — empty unpaid sections may be expected.';
  } else if (unpaid.length > 0) {
    diagnosis =
      `Timeline looks consistent: ${unpaid.length} unpaid row(s); UI should list them under Overdue/Pending/Advance from status/displayBucket. If labels are wrong, fix displayBucket or dates on the API.`;
  } else {
    diagnosis = 'Unpaid count is 0; verify month field format (YYYY-MM) and business rules.';
  }

  const successFlag = (responseBody as { success?: boolean })?.success;
  const importantPayload = {
    success: successFlag,
    dataKeys: typeof dataObj === 'object' ? Object.keys(dataObj) : [],
    monthlyInstallments: dataObj.monthlyInstallments ?? '(missing key — UI expects data.monthlyInstallments)',
    memberSummary: dataObj.member ?? dataObj.memberName ?? null,
  };

  const copyPastePrompt = `
================================================================================
COPY-PASTE FOR BACKEND — FitNix member monthly payments (auto-generated)
================================================================================

## 1) REQUEST (exact call from portal)
- Method: GET
- URL path (relative, same-origin): ${requestPath}
- Path parameter memberId: ${memberId}
- Query string: type=monthly
- Note: Next.js /api/[...path] proxy forwards to NEXT_PUBLIC_API_URL + /api/...

## 2) RESPONSE (facts)
- HTTP status: ${httpStatus}
- Top-level success: ${String(successFlag)}
- Member name from payload (if any): ${memberNameFromPayload}

## 3) IMPORTANT PART OF RESPONSE (what the UI reads)
${JSON.stringify(importantPayload, null, 2)}

## 4) ROWS AFTER CLIENT NORMALIZATION (${normalized.length} row(s))
${JSON.stringify(rowsSummary, null, 2)}

## 5) OBSERVED ISSUE (diagnosis)
${diagnosis}

## 6) CLIENT DATE HINT (backend should use GYM_TIMEZONE, not this)
- Browser ISO: ${today.toISOString()}
- Browser local YYYY-MM-DD: ${todayYm.y}-${String(todayYm.m).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}
- Latest PAID month parsed from row.month (YYYY-MM): ${lastPaidYm ? `${lastPaidYm.y}-${String(lastPaidYm.m).padStart(2, '0')}` : 'N/A'}

## 7) EXPECTED BEHAVIOR (what we need from the API)
${EXPECTED_MONTHLY_PAYMENTS_API_BEHAVIOR}

## 8) FULL RAW RESPONSE BODY (for deep debugging)
${JSON.stringify(responseBody, null, 2)}
================================================================================
END COPY-PASTE
================================================================================
`.trim();

  console.groupCollapsed(`${tag} GET member monthly payments`);
  console.log(`${tag} WHAT WE SENT (client → proxy → your API)`);
  console.log({
    method: 'GET',
    path: requestPath,
    pathParam_memberId: memberId,
    queryParams: { type: 'monthly' },
    note: 'Browser calls same-origin /api/...; Next.js proxy forwards to NEXT_PUBLIC_API_URL',
  });

  console.log(`${tag} HTTP STATUS`, httpStatus);

  console.log(
    `%c${tag} COPY-PASTE PROMPT (select all text below the line in console, or expand string)`,
    'font-weight:bold;color:#0a0;'
  );
  console.log(copyPastePrompt);

  console.log(`${tag} FULL JSON RESPONSE BODY (duplicate of section 8 above)`);
  console.log(JSON.stringify(responseBody, null, 2));

  console.log(`${tag} NORMALIZED TIMELINE ROWS (${normalized.length})`, rowsSummary);

  console.log(`${tag} COUNTS`, {
    totalRows: normalized.length,
    paidCount: paid.length,
    unpaidCount: unpaid.length,
    memberNameFromPayload,
  });

  console.log(`${tag} CLIENT "TODAY" (browser — API should use GYM_TIMEZONE)`, {
    iso: today.toISOString(),
    localDate: `${todayYm.y}-${String(todayYm.m).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
  });

  if (lastPaidYm) {
    console.log(`${tag} LATEST PAID MONTH (from row.month labels)`, `${lastPaidYm.y}-${String(lastPaidYm.m).padStart(2, '0')}`);
  } else {
    console.log(`${tag} LATEST PAID MONTH`, '(could not parse YYYY-MM from paid rows’ month field)');
  }

  console.warn(`${tag} DIAGNOSIS (short)`, diagnosis);
  console.groupEnd();
}

function logMemberPaymentsGetFailedHandoff(opts: {
  memberId: string;
  requestPath: string;
  httpStatus: number;
  responseBody: unknown;
  reason: 'success_false' | 'network';
  errorMessage?: string;
}) {
  if (!shouldLogMemberPaymentsDebug()) return;
  const tag = '[FitNix Payments → BACKEND DEBUG]';
  const { memberId, requestPath, httpStatus, responseBody, reason, errorMessage } = opts;
  const prompt = `
================================================================================
COPY-PASTE FOR BACKEND — member payments GET failed (${reason})
================================================================================
## REQUEST
- GET ${requestPath}
- memberId: ${memberId}
- Query: type=monthly

## RESPONSE / ERROR
- HTTP status: ${httpStatus}
- Client error message: ${errorMessage ?? '(n/a)'}

## RESPONSE BODY (if any)
${JSON.stringify(responseBody, null, 2)}

## EXPECTED BEHAVIOR
${EXPECTED_MONTHLY_PAYMENTS_API_BEHAVIOR}
- This request should return success: true and data.monthlyInstallments for the member.

================================================================================
`.trim();
  console.error(`${tag} ${prompt}`);
}

const EXPECTED_MARK_PAID_API_BEHAVIOR = `Expected from mark-paid APIs:
- Respond with success: true when the installment is persisted as PAID (paidDate set, status PAID).
- After payment, GET /api/members/:memberId/payments?type=monthly should return an updated timeline: paid rows updated, and (for active memberships) any **new** unpaid months that should exist per billing rules should appear so the gym can collect the next period.
- POST /api/payments/bulk-mark-paid body: { paymentIds: number[] } — IDs must match your Payment primary keys; if you use UUIDs, align with the portal or accept strings.`;

function logMarkPaidCopyPastePrompt(opts: {
  kind: 'POST /api/payments/bulk-mark-paid' | 'PATCH /api/payments/:id/mark-paid';
  path: string;
  requestSummary: Record<string, unknown>;
  httpStatus: number;
  responseBody: unknown;
}) {
  if (!shouldLogMemberPaymentsDebug()) return;
  const tag = '[FitNix Payments → BACKEND DEBUG]';
  const success = (opts.responseBody as { success?: boolean })?.success;
  const prompt = `
================================================================================
COPY-PASTE FOR BACKEND — ${opts.kind}
================================================================================
## REQUEST
- Path: ${opts.path}
${JSON.stringify(opts.requestSummary, null, 2)}

## RESPONSE
- HTTP status: ${opts.httpStatus}
- success: ${String(success)}
${JSON.stringify(opts.responseBody, null, 2)}

## EXPECTED BEHAVIOR
${EXPECTED_MARK_PAID_API_BEHAVIOR}
================================================================================
`.trim();
  console.log(`%c${tag} COPY-PASTE (mark-paid)`, 'font-weight:bold;color:#06c;');
  console.log(prompt);
}

export default function MemberPaymentsDetailPage() {
  const params = useParams();
  const memberId = String(params.id ?? '');
  const { user } = useAuth();
  const { alert, showAlert, closeAlert } = useAlert();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string>('');
  const [monthlyInstallments, setMonthlyInstallments] = useState<MonthlyInstallment[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [singleConfirm, setSingleConfirm] = useState<MonthlyInstallment | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!memberId) return;
    try {
      setLoading(true);
      setError(null);
      const requestPath = `/api/members/${memberId}/payments?type=monthly`;
      const response = await api.get(requestPath);
      if (!response.data?.success) {
        logMemberPaymentsGetFailedHandoff({
          memberId,
          requestPath,
          httpStatus: response.status,
          responseBody: response.data,
          reason: 'success_false',
          errorMessage: (response.data as { error?: { message?: string } })?.error?.message,
        });
        throw new Error(response.data?.error?.message || 'Failed to load payments');
      }
      const data = response.data.data || {};
      const timeline = (data.monthlyInstallments || []) as Record<string, unknown>[];
      const normalized = timeline.map(normalizeInstallment).sort(sortByDueDate);
      logMemberPaymentsTimelineDebug({
        memberId,
        requestPath,
        httpStatus: response.status,
        responseBody: response.data,
        normalized,
      });
      setMonthlyInstallments(normalized);

      const nameFromPayload =
        data.member?.name ||
        normalized[0]?.member?.name ||
        (data.memberName as string) ||
        '';
      if (nameFromPayload) setMemberName(nameFromPayload);
      else {
        try {
          const mRes = await api.get(`/api/members/${memberId}`);
          if (mRes.data?.success && mRes.data.data?.member?.name) {
            setMemberName(mRes.data.data.member.name);
          }
        } catch {
          /* optional */
        }
      }
    } catch (e: unknown) {
      const msg = getErrorMessage(e);
      if (shouldLogMemberPaymentsDebug()) {
        const err = e as { response?: { status?: number; data?: unknown }; config?: { url?: string } };
        logMemberPaymentsGetFailedHandoff({
          memberId,
          requestPath: `/api/members/${memberId}/payments?type=monthly`,
          httpStatus: err.response?.status ?? 0,
          responseBody: err.response?.data ?? { note: 'No response body (network/CORS/timeout?)' },
          reason: 'network',
          errorMessage: msg,
        });
      }
      setError(msg);
      showAlert('error', 'Error', msg);
    } finally {
      setLoading(false);
    }
  }, [memberId, showAlert]);

  useEffect(() => {
    setSelectedIds(new Set());
    fetchDetail();
  }, [fetchDetail]);

  /**
   * Sections follow API displayBucket per row (gym TZ on server). Falls back to browser-local rules only if displayBucket is missing.
   * Order: Overdue → Pending → Advance → Paid (same as monthlyGrouped).
   */
  const grouped = useMemo(() => {
    const paid: MonthlyInstallment[] = [];
    const overdue: MonthlyInstallment[] = [];
    const pending: MonthlyInstallment[] = [];
    const advance: MonthlyInstallment[] = [];

    for (const i of monthlyInstallments) {
      if (i.status === 'PAID') {
        paid.push(i);
        continue;
      }
      switch (uiBucketForInstallment(i)) {
        case 'overdue':
          overdue.push(i);
          break;
        case 'pending':
          pending.push(i);
          break;
        case 'advance':
          advance.push(i);
          break;
        default:
          pending.push(i);
      }
    }

    return {
      paid: paid.sort(sortByDueDate),
      overdue: overdue.sort(sortByDueDate),
      pending: pending.sort(sortByDueDate),
      advance: advance.sort(sortByDueDate),
    };
  }, [monthlyInstallments]);

  const selectableUnpaid = useMemo(() => {
    return monthlyInstallments.filter(isInstallmentUnpaid);
  }, [monthlyInstallments]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllUnpaid = () => {
    const all = new Set(selectableUnpaid.map((i) => i.id));
    setSelectedIds(all);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkMarkPaid = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      showAlert('warning', 'Nothing selected', 'Select at least one unpaid installment.');
      return;
    }
    const tag = '[FitNix Payments → BACKEND DEBUG]';
    let paymentsDebugGroup = false;
    try {
      setBulkSubmitting(true);
      const paymentIds = ids.map((id) => Number(id)).filter((n) => !Number.isNaN(n));
      if (shouldLogMemberPaymentsDebug()) {
        console.groupCollapsed(`${tag} POST /api/payments/bulk-mark-paid`);
        paymentsDebugGroup = true;
        console.log(`${tag} REQUEST`, {
          method: 'POST',
          path: '/api/payments/bulk-mark-paid',
          body: { paymentIds },
          selectedCheckboxIds_asStrings: ids,
          numericIdsSent_count: paymentIds.length,
          droppedBecauseNotNumeric_count: ids.length - paymentIds.length,
          issueIfDropped:
            ids.length !== paymentIds.length
              ? 'BACKEND: IDs are not all numeric — portal strips non-numeric; bulk payload may be wrong. Use numeric payment PKs or accept string IDs in API.'
              : undefined,
        });
      }
      const response = await api.post('/api/payments/bulk-mark-paid', { paymentIds });
      if (shouldLogMemberPaymentsDebug()) {
        console.log(`${tag} RESPONSE`, { httpStatus: response.status, body: response.data });
        if (!response.data?.success) {
          console.error(`${tag} bulk-mark-paid returned success:false`, response.data);
        }
        logMarkPaidCopyPastePrompt({
          kind: 'POST /api/payments/bulk-mark-paid',
          path: '/api/payments/bulk-mark-paid',
          requestSummary: {
            method: 'POST',
            body: { paymentIds },
            selectedCheckboxIds_asStrings: ids,
            droppedNonNumeric_count: ids.length - paymentIds.length,
          },
          httpStatus: response.status,
          responseBody: response.data,
        });
      }
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || 'Bulk mark paid failed');
      }
      showAlert('success', 'Payments recorded', `${ids.length} installment(s) marked as paid.`);
      clearSelection();
      await fetchDetail();
    } catch (e: unknown) {
      if (shouldLogMemberPaymentsDebug()) {
        const err = e as { response?: { status?: number; data?: unknown } };
        console.error(`${tag} POST bulk-mark-paid ERROR (network or thrown)`, {
          message: getErrorMessage(e),
          httpStatus: err.response?.status,
          responseBody: err.response?.data,
        });
      }
      showAlert('error', 'Error', getErrorMessage(e));
    } finally {
      if (paymentsDebugGroup) {
        console.groupEnd();
      }
      setBulkSubmitting(false);
    }
  };

  const handleSingleMarkPaid = async (inst: MonthlyInstallment) => {
    const tag = '[FitNix Payments → BACKEND DEBUG]';
    const path = `/api/payments/${inst.id}/mark-paid`;
    let paymentsDebugGroup = false;
    try {
      setBulkSubmitting(true);
      if (shouldLogMemberPaymentsDebug()) {
        console.groupCollapsed(`${tag} PATCH mark-paid`);
        paymentsDebugGroup = true;
        console.log(`${tag} REQUEST`, {
          method: 'PATCH',
          path,
          pathParam_paymentId: inst.id,
          installment: { month: inst.month, status: inst.status, dueDate: inst.dueDate, amount: inst.amount },
        });
      }
      const response = await api.patch(path);
      if (shouldLogMemberPaymentsDebug()) {
        console.log(`${tag} RESPONSE`, { httpStatus: response.status, body: response.data });
        if (!response.data?.success) {
          console.error(`${tag} mark-paid returned success:false`, response.data);
        }
        logMarkPaidCopyPastePrompt({
          kind: 'PATCH /api/payments/:id/mark-paid',
          path,
          requestSummary: {
            method: 'PATCH',
            pathParam_paymentId: inst.id,
            installment: { month: inst.month, status: inst.status, dueDate: inst.dueDate },
          },
          httpStatus: response.status,
          responseBody: response.data,
        });
      }
      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || 'Mark paid failed');
      }
      showAlert('success', 'Payment recorded', 'Installment marked as paid.');
      setSingleConfirm(null);
      await fetchDetail();
    } catch (e: unknown) {
      if (shouldLogMemberPaymentsDebug()) {
        const err = e as { response?: { status?: number; data?: unknown } };
        console.error(`${tag} PATCH mark-paid ERROR (network or thrown)`, {
          path,
          message: getErrorMessage(e),
          httpStatus: err.response?.status,
          responseBody: err.response?.data,
        });
      }
      showAlert('error', 'Error', getErrorMessage(e));
    } finally {
      if (paymentsDebugGroup) {
        console.groupEnd();
      }
      setBulkSubmitting(false);
    }
  };

  const getBucketColor = (bucket: InstallmentUiBucket) => {
    switch (bucket) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'advance':
        return 'bg-sky-100 text-sky-900';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handlePrintReceipt = async (payment: MonthlyInstallment) => {
    if (payment.status !== 'PAID') {
      showAlert('warning', 'Cannot print receipt', 'Receipts are only available for paid installments.');
      return;
    }
    let packageInfo: { name: string; price: number; discount?: number | null; duration?: string } | null = null;
    let originalAmount = payment.amount;
    let discountAmount = 0;
    try {
      const memberResponse = await api.get(`/api/members/${memberId}`);
      if (memberResponse.data.success && memberResponse.data.data.member) {
        const member = memberResponse.data.data.member;
        if (member.packageId) {
          const packageResponse = await api.get(`/api/packages/${member.packageId}`);
          if (packageResponse.data.success && packageResponse.data.data.package) {
            packageInfo = packageResponse.data.data.package;
            if (packageInfo) {
              const packagePrice = packageInfo.price;
              const packageDiscount = packageInfo.discount || 0;
              const isAnnual = packageInfo.duration?.includes('12') || false;
              let monthlyBase = isAnnual ? packagePrice / 12 : packagePrice;
              if (packageDiscount > 0) {
                if (isAnnual) {
                  monthlyBase = (packagePrice - packageDiscount) / 12;
                  discountAmount = packageDiscount / 12;
                } else {
                  monthlyBase = packagePrice - packageDiscount;
                  discountAmount = packageDiscount;
                }
              }
              originalAmount = isAnnual ? packagePrice / 12 : packagePrice;
            }
          }
        }
      }
    } catch {
      /* continue */
    }

    const displayName = memberName || payment.member?.name || 'Member';
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Receipt - ${displayName}</title>
          <style>
            @media print { @page { margin: 20mm; } }
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; border-bottom: 3px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
            .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .amount-section { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 30px 0; }
            .amount-row { display: flex; justify-content: space-between; font-size: 18px; margin: 10px 0; }
            .total { font-size: 24px; font-weight: bold; border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; }
            .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
            .status-badge { display: inline-block; padding: 5px 15px; background: #10b981; color: white; border-radius: 20px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header"><h1>FitNixTrack Gym</h1><p>Payment Receipt</p></div>
          <div class="info-row"><span><strong>Receipt #</strong></span><span>${payment.id}</span></div>
          <div class="info-row"><span><strong>Date</strong></span><span>${formatDate(payment.paidDate || payment.dueDate)}</span></div>
          <div class="info-row"><span><strong>Member</strong></span><span>${displayName}</span></div>
          <div class="info-row"><span><strong>Month</strong></span><span>${payment.month}</span></div>
          <div class="info-row"><span><strong>Status</strong></span><span><span class="status-badge">PAID</span></span></div>
          <div class="amount-section">
            ${packageInfo && discountAmount > 0 ? `<div class="amount-row"><span>Package</span><span>${packageInfo.name}</span></div>` : ''}
            <div class="amount-row total"><span>Total Paid</span><span>Rs. ${payment.amount.toFixed(2)}</span></div>
          </div>
          <div class="footer"><p>Thank you for your payment!</p></div>
        </body>
      </html>
    `;
    const blob = new Blob([receiptHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    if (!printWindow) {
      showAlert('error', 'Print error', 'Allow popups to print receipts.');
      URL.revokeObjectURL(url);
      return;
    }
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        URL.revokeObjectURL(url);
      }, 250);
    };
  };

  const renderSection = (title: string, items: MonthlyInstallment[], showSelect: boolean) => {
    if (items.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-6 text-center text-sm text-gray-500">
          No {title.toLowerCase()} installments.
        </div>
      );
    }
    return (
      <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-light-gray">
            <tr>
              {showSelect && user?.role === 'GYM_ADMIN' && (
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray w-12"> </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Month</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Due</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Status</th>
              {user?.role === 'GYM_ADMIN' && (
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {items.map((row) => {
              const bucket = uiBucketForInstallment(row);
              const canSelect = showSelect && isInstallmentUnpaid(row);
              return (
                <tr key={row.id} className="hover:bg-gray-50/80">
                  {showSelect && user?.role === 'GYM_ADMIN' && (
                    <td className="px-4 py-3">
                      {canSelect ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleSelect(row.id)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      ) : (
                        <span className="inline-block w-4" />
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-gray-900">{row.month}</td>
                  <td className="px-4 py-3 text-sm">Rs. {row.amount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(row.dueDate)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getBucketColor(bucket)}`}
                    >
                      {uiLabelForBucket(bucket)}
                    </span>
                  </td>
                  {user?.role === 'GYM_ADMIN' && (
                    <td className="px-4 py-3 text-sm">
                      {row.status !== 'PAID' ? (
                        <button
                          type="button"
                          onClick={() => setSingleConfirm(row)}
                          className="rounded-lg bg-green-600 px-3 py-1.5 font-medium text-white hover:bg-green-700"
                        >
                          Mark paid
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePrintReceipt(row)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-gray-800 hover:bg-gray-50"
                        >
                          Receipt
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading && monthlyInstallments.length === 0 && !error) {
    return (
      <Layout>
        <Loading message="Loading member payments..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <Alert isOpen={alert.isOpen} onClose={closeAlert} type={alert.type} title={alert.title} message={alert.message} />
      <ConfirmationDialog
        isOpen={!!singleConfirm}
        onClose={() => setSingleConfirm(null)}
        onConfirm={() => singleConfirm && handleSingleMarkPaid(singleConfirm)}
        title="Mark installment as paid"
        message={
          singleConfirm
            ? `Mark Rs. ${singleConfirm.amount.toFixed(2)} for ${singleConfirm.month} as paid?`
            : ''
        }
        confirmText="Mark as paid"
        cancelText="Cancel"
        type="warning"
      />

      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/payments" className="text-sm font-medium text-primary hover:underline">
              ← Back to payments
            </Link>
            <h1 className="mt-2 text-3xl font-bold text-dark-gray">{memberName || 'Member payments'}</h1>
          </div>
          {user?.role === 'GYM_ADMIN' && selectableUnpaid.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={selectAllUnpaid}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-dark-gray hover:bg-gray-50"
              >
                Select all unpaid
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-dark-gray hover:bg-gray-50"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={bulkSubmitting || selectedIds.size === 0}
                onClick={handleBulkMarkPaid}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bulkSubmitting ? 'Saving…' : `Mark paid (${selectedIds.size})`}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <p className="font-medium">Could not load payments</p>
            <p className="text-sm">{error}</p>
            <button
              type="button"
              onClick={() => fetchDetail()}
              className="mt-3 rounded-lg bg-red-700 px-3 py-1.5 text-sm text-white hover:bg-red-800"
            >
              Retry
            </button>
          </div>
        )}

        {loading && monthlyInstallments.length > 0 && (
          <p className="text-sm text-gray-500">Refreshing…</p>
        )}

        {monthlyInstallments.length === 0 && !loading && !error ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-gray-500">
            No monthly installment history for this member.
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-dark-gray">Overdue</h2>
              {renderSection('overdue', grouped.overdue, true)}
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-dark-gray">Pending</h2>
              {renderSection('pending', grouped.pending, true)}
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-dark-gray">Advance</h2>
              {renderSection('advance', grouped.advance, true)}
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-dark-gray">Paid</h2>
              {renderSection('paid', grouped.paid, false)}
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

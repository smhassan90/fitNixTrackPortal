import { formatDate } from '@/lib/dateUtils';
import type { PendingOneTimePayment } from '@/lib/signupFees';

export interface SignupReceiptContext {
  memberName: string;
  memberId?: string | number;
  gymName?: string;
  printedBy?: string;
  oneTime: Pick<
    PendingOneTimePayment,
    'admissionFee' | 'packageFee' | 'trainerFee' | 'totalAmount'
  >;
  admissionWaived?: boolean;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSignupReceiptHtml(ctx: SignupReceiptContext): string {
  const { oneTime } = ctx;
  const admissionFee =
    oneTime.admissionFee > 0
      ? oneTime.admissionFee
      : Math.max(0, oneTime.totalAmount - oneTime.packageFee - oneTime.trainerFee);
  const receiptNo = ctx.memberId != null ? `SIGNUP-${ctx.memberId}` : 'SIGNUP';
  const gymTitle = ctx.gymName?.trim() || 'FitNixTrack Gym';
  const printedBy = ctx.printedBy?.trim() || 'Staff';
  const generatedAt = new Date().toISOString();

  const admissionRow =
    admissionFee > 0
      ? `<div class="row"><span>Admission fee</span><span>Rs. ${admissionFee.toFixed(2)}</span></div>`
      : ctx.admissionWaived
        ? `<div class="row muted"><span>Admission fee</span><span>Waived</span></div>`
        : '';

  const packageRow =
    oneTime.packageFee > 0
      ? `<div class="row"><span>Package (1st month)</span><span>Rs. ${oneTime.packageFee.toFixed(2)}</span></div>`
      : '';

  const trainerRow =
    oneTime.trainerFee > 0
      ? `<div class="row"><span>Trainer fee</span><span>Rs. ${oneTime.trainerFee.toFixed(2)}</span></div>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Signup receipt — ${escapeHtml(ctx.memberName)}</title>
    <style>
      @media print {
        @page { size: A4 portrait; margin: 10mm; }
        html, body {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
        }
        .page { min-height: 100%; border: none; }
      }
      * { box-sizing: border-box; }
      html, body {
        width: 100%;
        min-height: 100vh;
        margin: 0;
        padding: 0;
      }
      body {
        font-family: system-ui, Arial, sans-serif;
        color: #111;
        display: flex;
        flex-direction: column;
      }
      .page {
        display: flex;
        flex-direction: column;
        width: 100%;
        min-height: 100vh;
        padding: 24px;
      }
      .head {
        text-align: center;
        border-bottom: 2px solid #111;
        padding-bottom: 20px;
        margin-bottom: 24px;
      }
      .head h1 { margin: 0; font-size: 32px; }
      .head p { margin: 8px 0 0; font-size: 16px; color: #555; }
      .meta {
        font-size: 15px;
        margin-bottom: 24px;
        flex: 1;
      }
      .meta div {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #f3f4f6;
      }
      .amt {
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 24px;
        margin-top: auto;
      }
      .row {
        display: flex;
        justify-content: space-between;
        font-size: 16px;
        padding: 10px 0;
      }
      .row.muted { color: #6b7280; }
      .total {
        display: flex;
        justify-content: space-between;
        font-size: 24px;
        font-weight: 700;
        border-top: 2px solid #111;
        margin-top: 16px;
        padding-top: 16px;
      }
      .foot {
        margin-top: 24px;
        text-align: center;
        font-size: 13px;
        color: #6b7280;
        border-top: 1px dashed #d1d5db;
        padding-top: 16px;
      }
    </style>
  </head>
  <body>
    <div class="page">
    <div class="head">
      <h1>${escapeHtml(gymTitle)}</h1>
      <p>Signup / one-time payment receipt</p>
    </div>
    <div class="meta">
      <div><span>Receipt</span><span>${escapeHtml(receiptNo)}</span></div>
      <div><span>Date</span><span>${escapeHtml(formatDate(generatedAt))}</span></div>
      <div><span>Member</span><span>${escapeHtml(ctx.memberName)}</span></div>
    </div>
    <div class="amt">
      ${admissionRow}
      ${packageRow}
      ${trainerRow}
      <div class="total"><span>Total received</span><span>Rs. ${oneTime.totalAmount.toFixed(2)}</span></div>
    </div>
    <div class="foot">
      Printed by ${escapeHtml(printedBy)} · ${escapeHtml(formatDate(generatedAt))}<br />
      Thank you — retain for your records
    </div>
    </div>
  </body>
</html>`;
}

export function openSignupReceiptPrintWindow(html: string): Window | null {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank');
  if (!printWindow) {
    URL.revokeObjectURL(url);
    return null;
  }
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
      URL.revokeObjectURL(url);
    }, 350);
  };
  return printWindow;
}

export function printSignupReceipt(ctx: SignupReceiptContext): void {
  const html = buildSignupReceiptHtml(ctx);
  const win = openSignupReceiptPrintWindow(html);
  if (!win) {
    throw new Error('Allow popups to print receipts.');
  }
}

export { printOneTimePaymentReceipt } from '@/lib/paymentReceipt';

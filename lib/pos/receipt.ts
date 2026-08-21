import type { PosSale } from '@/lib/pos/types';
import { formatMoney } from '@/lib/pos/utils';
import { formatDate } from '@/lib/dateUtils';
import { normalizeWhatsAppPhone } from '@/lib/whatsappOverdue';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type PosReceiptPrintContext = {
  sale: PosSale;
  gymName?: string | null;
};

export function buildPosReceiptHtml({ sale, gymName }: PosReceiptPrintContext): string {
  const gym = (gymName ?? '').trim() || 'FitNix POS';
  const member = (sale.memberName ?? '').trim() || 'Walk-in';
  const lines = sale.items
    .map((line) => {
      const name = escapeHtml(line.productName ?? `Product #${line.productId}`);
      return `<tr>
        <td>${name}</td>
        <td class="qty">${line.quantity}</td>
        <td class="amt">${escapeHtml(formatMoney(line.unitPrice))}</td>
        <td class="amt">${escapeHtml(formatMoney(line.lineTotal))}</td>
      </tr>`;
    })
    .join('');

  const discountRow =
    sale.discountTotal > 0
      ? `<div class="row"><span>Discount</span><span>-${escapeHtml(formatMoney(sale.discountTotal))}</span></div>`
      : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${escapeHtml(sale.receiptNo)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      margin: 0;
      padding: 16px;
      color: #1a1a1a;
      background: #fff;
    }
    .ticket {
      width: 100%;
      max-width: 320px;
      margin: 0 auto;
    }
    h1 {
      font-size: 16px;
      margin: 0 0 4px;
      text-align: center;
    }
    .muted {
      color: #555;
      font-size: 11px;
      text-align: center;
      margin: 0 0 12px;
    }
    .meta {
      font-size: 12px;
      margin-bottom: 12px;
      border-top: 1px dashed #999;
      border-bottom: 1px dashed #999;
      padding: 8px 0;
    }
    .meta div { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th, td {
      padding: 4px 0;
      vertical-align: top;
    }
    th {
      text-align: left;
      border-bottom: 1px solid #ccc;
      font-weight: 600;
    }
    .qty, .amt { text-align: right; white-space: nowrap; }
    .totals {
      margin-top: 10px;
      border-top: 1px dashed #999;
      padding-top: 8px;
      font-size: 12px;
    }
    .row { display: flex; justify-content: space-between; margin: 3px 0; }
    .total { font-weight: 700; font-size: 14px; margin-top: 6px; }
    .thanks {
      margin-top: 16px;
      text-align: center;
      font-size: 11px;
      color: #555;
    }
    @media print {
      body { padding: 0; }
      .ticket { max-width: none; }
    }
  </style>
</head>
<body>
  <div class="ticket">
    <h1>${escapeHtml(gym)}</h1>
    <p class="muted">POS Sale Receipt</p>
    <div class="meta">
      <div><span>Receipt</span><span>${escapeHtml(sale.receiptNo)}</span></div>
      <div><span>Date</span><span>${escapeHtml(formatDate(sale.createdAt))}</span></div>
      <div><span>Member</span><span>${escapeHtml(member)}</span></div>
      ${sale.notes?.trim() ? `<div><span>Notes</span><span>${escapeHtml(sale.notes.trim())}</span></div>` : ''}
    </div>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th class="qty">Qty</th>
          <th class="amt">Price</th>
          <th class="amt">Total</th>
        </tr>
      </thead>
      <tbody>${lines}</tbody>
    </table>
    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${escapeHtml(formatMoney(sale.subtotal))}</span></div>
      ${discountRow}
      <div class="row total"><span>Total</span><span>${escapeHtml(formatMoney(sale.total))}</span></div>
    </div>
    <p class="thanks">Thank you for your purchase</p>
  </div>
  <script>
    (function () {
      var done = false;
      function printOnce() {
        if (done) return;
        done = true;
        window.focus();
        window.print();
      }
      if (document.readyState === 'complete') setTimeout(printOnce, 150);
      else window.addEventListener('load', function () { setTimeout(printOnce, 150); });
    })();
  </script>
</body>
</html>`;
}

export function printPosReceipt(ctx: PosReceiptPrintContext): void {
  const html = buildPosReceiptHtml(ctx);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Allow popups to print receipts.');
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

export function buildPosReceiptWhatsAppMessage({ sale, gymName }: PosReceiptPrintContext): string {
  const gym = (gymName ?? '').trim() || 'your gym';
  const member = (sale.memberName ?? '').trim();
  const greeting = member ? `Hi ${member}!` : 'Hi!';

  const itemLines = sale.items.map((line) => {
    const name = line.productName ?? `Product #${line.productId}`;
    return `• ${name} x${line.quantity} — ${formatMoney(line.lineTotal)}`;
  });

  const lines = [
    greeting,
    '',
    `Here is your receipt from ${gym}.`,
    `Receipt: ${sale.receiptNo}`,
    `Date: ${formatDate(sale.createdAt)}`,
    '',
    ...itemLines,
    '',
    `Subtotal: ${formatMoney(sale.subtotal)}`,
  ];

  if (sale.discountTotal > 0) {
    lines.push(`Discount: -${formatMoney(sale.discountTotal)}`);
  }

  lines.push(`Total: ${formatMoney(sale.total)}`, '', 'Thank you!');
  return lines.join('\n');
}

function openPosWhatsAppChat(message: string, phone?: string | null): void {
  const normalized = normalizeWhatsAppPhone(phone);
  const url = normalized
    ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Opens WhatsApp with the POS receipt message (text only). */
export function sharePosReceiptOnWhatsApp(
  ctx: PosReceiptPrintContext,
  phone?: string | null
): { openedChat: boolean } {
  const message = buildPosReceiptWhatsAppMessage(ctx);
  const resolvedPhone = phone ?? ctx.sale.memberPhone ?? null;
  openPosWhatsAppChat(message, resolvedPhone);
  return { openedChat: true };
}

/** Opens WhatsApp with the receipt text. Uses phone when available; otherwise opens chat picker. */
export function openPosReceiptWhatsApp(
  ctx: PosReceiptPrintContext,
  phone?: string | null
): boolean {
  sharePosReceiptOnWhatsApp(ctx, phone);
  return true;
}

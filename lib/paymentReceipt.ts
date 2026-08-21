import api from '@/lib/api';
import { formatDate } from '@/lib/dateUtils';
import { displayMemberId, normalizeMemberNumberFields } from '@/lib/displayMemberId';
import { resolveMediaUrl } from '@/lib/resolveMediaUrl';
import { normalizeWhatsAppPhone } from '@/lib/whatsappOverdue';

export interface PaymentReceiptPrintedBy {
  name: string;
  email?: string | null;
  role?: string | null;
}

export interface SignupPaymentReceiptSection {
  admissionFee: number;
  packageFee: number;
  trainerFee: number;
  totalAmount: number;
  memberDiscount?: number | null;
}

export type PaymentReceiptType = 'monthly' | 'one-time' | 'signup-monthly';

export interface ReceiptEnrichmentHints {
  memberDiscount?: number | null;
}

export interface PaymentReceiptData {
  receiptNumber: string;
  receiptType?: PaymentReceiptType;
  generatedAt: string;
  printedBy?: PaymentReceiptPrintedBy | null;
  gym: {
    name: string;
    logoUrl?: string | null;
    address?: string | null;
    city?: string | null;
    country?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  member: {
    /** Internal PK — used only for API enrichment when still present. */
    id?: string | number;
    /** Gym-facing Member ID for receipts. */
    memberNumber?: string | number | null;
    legacyMemberId?: string | number | null;
    name: string;
    email?: string | null;
    phone?: string | null;
    cnic?: string | null;
    membershipStart?: string | null;
    membershipEnd?: string | null;
    monthlyPaymentAmount?: number | null;
    memberDiscount?: number | null;
    isActive?: boolean;
  };
  package: {
    name: string;
    duration: string;
    price: number;
    discount?: number | null;
    features?: string[];
    /** Installment coverage start (YYYY-MM-DD from receipt API). */
    startDate?: string | null;
    /** Installment coverage expiry (YYYY-MM-DD from receipt API). */
    expiryDate?: string | null;
  } | null;
  trainers: { name: string; charges?: number | null }[];
  signupPayment?: SignupPaymentReceiptSection | null;
  payment: {
    id?: string | number;
    month: string;
    amount: number;
    monthlyInstallmentAmount?: number | null;
    status: string;
    dueDate: string;
    paidDate?: string | null;
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(amount: number | null | undefined): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return 'Rs.\u00a00';
  const hasFraction = Math.abs(n % 1) > 1e-9;
  const formatted = n.toLocaleString('en-US', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  });
  // Non-breaking space keeps "Rs." and the amount on one line.
  return `Rs.\u00a0${formatted}`;
}

function formatReceiptDate(dateInput: string | null | undefined): string {
  if (!dateInput) return '—';
  const normalized = dateInput.includes('T') ? dateInput : `${dateInput}T12:00:00`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return formatDate(dateInput);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatReceiptDateUpper(dateInput: string | null | undefined): string {
  return formatReceiptDate(dateInput).toUpperCase();
}

function formatReceiptMonthFull(monthKey: string): string {
  const [y, m] = monthKey.split('-').map((x) => parseInt(x, 10));
  if (!y || !m) return monthKey;
  const d = new Date(y, m - 1, 1);
  // Abbreviated month keeps the value on a single line in the receipt column (e.g. "Feb, 2026").
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return `${month}, ${y}`;
}

export function resolveGymLogoUrl(logoUrl?: string | null): string | null {
  return resolveMediaUrl(logoUrl);
}

function receiptBoxRow(label: string, value: unknown): string {
  if (value == null || String(value).trim() === '') return '';
  return `<div class="row"><span class="lbl">${escapeHtml(label)}:</span><span class="val">${escapeHtml(value)}</span></div>`;
}

function receiptSection(title: string, rows: string): string {
  if (!rows.trim()) return '';
  return `<div class="section"><div class="section-title">${escapeHtml(title)}</div>${rows}</div>`;
}

function receiptBoxRowOptional(label: string, rawDate: string | null | undefined): string {
  if (rawDate == null || String(rawDate).trim() === '') return '';
  return receiptBoxRow(label, formatReceiptDate(rawDate));
}

/** Coverage period from receipt API `package.startDate` / `package.expiryDate` (YYYY-MM-DD). */
function buildPackageInformationRows(data: PaymentReceiptData): string {
  let rows = receiptBoxRow('PACKAGE', data.package?.name || '—');
  rows += receiptBoxRowOptional('START', data.package?.startDate);
  rows += receiptBoxRowOptional('EXPIRY', data.package?.expiryDate);
  return rows;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function normalizePackageDate(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (!s) return null;
  // Receipt API sends YYYY-MM-DD; ignore time portion if present.
  const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function mergeReceiptPackageCoverage(
  receiptPkg: PaymentReceiptData['package'],
  catalogPkg: PaymentReceiptData['package']
): PaymentReceiptData['package'] {
  if (!catalogPkg) return receiptPkg;
  if (!receiptPkg) return catalogPkg;
  return {
    ...catalogPkg,
    startDate: receiptPkg.startDate ?? catalogPkg.startDate ?? null,
    expiryDate: receiptPkg.expiryDate ?? catalogPkg.expiryDate ?? null,
  };
}

function normalizePackage(pkgRaw: unknown): PaymentReceiptData['package'] {
  const p = asRecord(pkgRaw);
  if (!p?.name) return null;
  const featuresRaw = p.features;
  let features: string[] = [];
  if (Array.isArray(featuresRaw)) {
    features = featuresRaw
      .map((f) => {
        if (typeof f === 'string') return f;
        const fo = asRecord(f);
        return fo?.name != null ? String(fo.name) : '';
      })
      .filter(Boolean);
  }
  return {
    name: String(p.name),
    duration: String(p.duration ?? ''),
    price: Number(p.price) || 0,
    discount: p.discount != null ? Number(p.discount) : null,
    features,
    startDate: normalizePackageDate(p.startDate),
    expiryDate: normalizePackageDate(p.expiryDate),
  };
}

function normalizeTrainers(list: unknown): PaymentReceiptData['trainers'] {
  if (!Array.isArray(list)) return [];
  return list
    .map((t) => {
      const row = asRecord(t);
      if (!row) return null;
      const nested = asRecord(row.trainer);
      const name = String(nested?.name ?? row.name ?? '').trim();
      if (!name) return null;
      const chargesRaw = nested?.charges ?? row.charges;
      return {
        name,
        charges: chargesRaw != null ? Number(chargesRaw) : null,
      };
    })
    .filter((t): t is { name: string; charges: number | null } => t != null);
}

function packageNetMonthly(pkg: NonNullable<PaymentReceiptData['package']>): number {
  const discount = Number(pkg.discount) || 0;
  const isAnnual = pkg.duration.includes('12');
  return isAnnual ? Math.max(0, pkg.price - discount) / 12 : Math.max(0, pkg.price - discount);
}

function isSignupReceipt(data: PaymentReceiptData): boolean {
  return data.receiptType === 'one-time' && data.signupPayment != null;
}

/** Prefer API signup total; never sum line items on the client for one-time receipts. */
export function resolveReceiptPaymentAmount(data: PaymentReceiptData): number {
  if (isSignupReceipt(data)) {
    return Number(data.signupPayment!.totalAmount) || Number(data.payment.amount) || 0;
  }
  return (
    Number(data.payment.amount) ||
    Number(data.payment.monthlyInstallmentAmount) ||
    0
  );
}

function withMemberDiscount(
  data: PaymentReceiptData,
  memberDiscount: number,
  target: 'signup' | 'member' | 'both' = 'both'
): PaymentReceiptData {
  if (memberDiscount <= 0) return data;
  return {
    ...data,
    member:
      target === 'signup'
        ? data.member
        : { ...data.member, memberDiscount },
    signupPayment:
      data.signupPayment && target !== 'member'
        ? {
            ...data.signupPayment,
            memberDiscount: data.signupPayment.memberDiscount ?? memberDiscount,
          }
        : data.signupPayment,
  };
}

/** Signup: signupPayment.memberDiscount only. Monthly: member.memberDiscount only. */
export function resolveReceiptMemberDiscountAmount(data: PaymentReceiptData): number {
  if (isSignupReceipt(data)) {
    const d = data.signupPayment?.memberDiscount;
    return d != null && !Number.isNaN(Number(d)) && Number(d) > 0 ? Number(d) : 0;
  }
  const d = data.member.memberDiscount;
  return d != null && !Number.isNaN(Number(d)) && Number(d) > 0 ? Number(d) : 0;
}

function applyReceiptEnrichment(
  data: PaymentReceiptData,
  hints?: ReceiptEnrichmentHints | null
): PaymentReceiptData {
  const hintDiscount = hints?.memberDiscount != null ? Number(hints.memberDiscount) : 0;
  if (hintDiscount <= 0) return data;

  if (isSignupReceipt(data) && resolveReceiptMemberDiscountAmount(data) <= 0) {
    return withMemberDiscount(data, hintDiscount, 'signup');
  }
  if (!isSignupReceipt(data) && resolveReceiptMemberDiscountAmount(data) <= 0) {
    return withMemberDiscount(data, hintDiscount, 'member');
  }
  return data;
}

function pickSignupPaymentRaw(raw: Record<string, unknown>): unknown {
  const payment = asRecord(raw.payment) ?? {};
  return (
    raw.signupPayment ??
    raw.signup ??
    raw.oneTimePayment ??
    payment.signupPayment ??
    payment.oneTimePayment ??
    payment.signup ??
    null
  );
}

function resolveMemberDiscount(
  member: Record<string, unknown>,
  signup: SignupPaymentReceiptSection | null
): number | null {
  if (signup?.memberDiscount != null && !Number.isNaN(Number(signup.memberDiscount))) {
    return Number(signup.memberDiscount);
  }
  if (member.memberDiscount != null && !Number.isNaN(Number(member.memberDiscount))) {
    return Number(member.memberDiscount);
  }
  if (member.discount != null && !Number.isNaN(Number(member.discount))) {
    return Number(member.discount);
  }
  return null;
}


async function enrichReceiptFromMember(
  data: PaymentReceiptData,
  memberId?: string | number
): Promise<PaymentReceiptData> {
  if (memberId == null) return data;
  const needsPackage = !data.package;
  const needsTrainers = data.trainers.length === 0;
  const needsTrainerCharges = data.trainers.some(
    (t) => t.charges == null || Number.isNaN(Number(t.charges))
  );
  const needsPackageFeatures =
    data.package != null && (!data.package.features || data.package.features.length === 0);
  const needsMemberDiscount =
    isSignupReceipt(data)
      ? !data.signupPayment?.memberDiscount
      : data.member.memberDiscount == null;
  const needsMemberNumber =
    data.member.memberNumber == null ||
    data.member.memberNumber === '' ||
    data.member.legacyMemberId == null ||
    data.member.legacyMemberId === '';

  if (
    !needsPackage &&
    !needsTrainers &&
    !needsTrainerCharges &&
    !needsPackageFeatures &&
    !needsMemberDiscount &&
    !needsMemberNumber
  ) {
    return data;
  }

  try {
    const res = await api.get(`/api/members/${memberId}`);
    if (!res.data?.success) return data;
    const root = asRecord(res.data.data);
    if (!root) return data;
    const m = asRecord(root.member) ?? root;

    let pkg = data.package;
    const packageId = m.packageId ?? asRecord(m.package)?.id;
    if (needsPackage || needsPackageFeatures) {
      if (packageId != null) {
        try {
          const pRes = await api.get(`/api/packages/${packageId}`);
          if (pRes.data?.success) {
            const full = normalizePackage(pRes.data.data?.package ?? pRes.data.data);
            if (full) pkg = mergeReceiptPackageCoverage(data.package, full);
          }
        } catch {
          if (!pkg && m.package) {
            pkg = mergeReceiptPackageCoverage(data.package, normalizePackage(m.package));
          }
        }
      } else if (!pkg && m.package) {
        pkg = mergeReceiptPackageCoverage(data.package, normalizePackage(m.package));
      }
    }

    const trainers =
      data.trainers.length > 0 && !needsTrainerCharges
        ? data.trainers
        : normalizeTrainers(m.trainers);

    let enriched: PaymentReceiptData = { ...data, package: pkg, trainers };
    const nums = normalizeMemberNumberFields(m);
    if (
      (enriched.member.memberNumber == null || enriched.member.memberNumber === '') &&
      nums.memberNumber
    ) {
      enriched = {
        ...enriched,
        member: {
          ...enriched.member,
          memberNumber: nums.memberNumber,
          legacyMemberId: nums.legacyMemberId,
        },
      };
    }
    const fetchedDiscount = resolveMemberDiscount(m, null);
    if (fetchedDiscount != null && fetchedDiscount > 0) {
      if (isSignupReceipt(enriched) && !enriched.signupPayment?.memberDiscount) {
        enriched = withMemberDiscount(enriched, fetchedDiscount, 'signup');
      } else if (!isSignupReceipt(enriched) && enriched.member.memberDiscount == null) {
        enriched = withMemberDiscount(enriched, fetchedDiscount, 'member');
      }
    }
    return enriched;
  } catch {
    return data;
  }
}

function buildPaymentDetailsRows(data: PaymentReceiptData): string {
  const memberDiscount = resolveReceiptMemberDiscountAmount(data);
  let rows = '';

  if (isSignupReceipt(data)) {
    const signup = data.signupPayment!;
    rows += receiptBoxRow('TYPE', 'Signup / one-time');
    if (signup.admissionFee) {
      rows += receiptBoxRow('ADMISSION FEE', formatMoney(signup.admissionFee));
    }
    if (signup.packageFee) {
      // API stores the package fee already net of the member discount. Show the
      // gross package price here so the separate DISCOUNT line isn't double-counted.
      const grossPackageFee = signup.packageFee + (memberDiscount > 0 ? memberDiscount : 0);
      rows += receiptBoxRow('PACKAGE', formatMoney(grossPackageFee));
    }
    if (signup.trainerFee) {
      rows += receiptBoxRow('TRAINER', formatMoney(signup.trainerFee));
    }
    if (memberDiscount > 0) {
      rows += receiptBoxRow('MEMBER DISCOUNT', `- ${formatMoney(memberDiscount)}`);
    }
    rows += receiptBoxRow('PAID DATE', formatReceiptDate(data.payment.paidDate || data.generatedAt));
    return rows;
  }

  // Regular monthly receipt — signupPayment is null; total comes from payment.amount
  if (data.payment.month) {
    rows += receiptBoxRow('MONTH', formatReceiptMonthFull(data.payment.month));
  }

  const pkg = data.package;
  if (pkg) {
    rows += receiptBoxRow('PACKAGE', formatMoney(packageNetMonthly(pkg)));
  }
  data.trainers.forEach((t, i) => {
    const label = data.trainers.length > 1 ? `TRAINER ${i + 1}` : 'TRAINER';
    const fee = t.charges != null && !Number.isNaN(Number(t.charges)) ? Number(t.charges) : 0;
    if (fee > 0) rows += receiptBoxRow(label, formatMoney(fee));
  });

  if (memberDiscount > 0) {
    rows += receiptBoxRow('MEMBER DISCOUNT', `- ${formatMoney(memberDiscount)}`);
  }
  rows += receiptBoxRow(
    'PAID DATE',
    formatReceiptDate(data.payment.paidDate || data.payment.dueDate || data.generatedAt)
  );

  return rows;
}

export function buildPaymentReceiptHtml(data: PaymentReceiptData): string {
  const logoUrl = resolveGymLogoUrl(data.gym.logoUrl);
  const receiptDate = formatReceiptDateUpper(
    data.payment.paidDate || data.payment.dueDate || data.generatedAt
  );

  const memberRows =
    receiptBoxRow('MEMBER ID', displayMemberId(data.member)) +
    receiptBoxRow('NAME', data.member.name) +
    receiptBoxRow('PHONE', data.member.phone);

  const packageRows = buildPackageInformationRows(data);

  const paymentRows = buildPaymentDetailsRows(data);
  const totalAmount = formatMoney(resolveReceiptPaymentAmount(data));

  const logoBlock = logoUrl
    ? `<div class="logo-wrap"><img class="logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(data.gym.name)}" /></div>`
    : `<div class="gym-name">${escapeHtml(data.gym.name || 'Gym')}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Receipt ${escapeHtml(data.receiptNumber)}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body {
        width: 100%;
        background: #fff;
      }
      body {
        font-family: Arial, Helvetica, sans-serif;
        color: #000;
        -webkit-font-smoothing: antialiased;
      }
      .rcpt {
        display: flex;
        flex-direction: column;
        width: 100%;
        max-width: 100%;
        margin: 0 auto;
        padding: 14px 18px 18px;
      }
      .top-bar,
      .brand,
      .divider {
        flex-shrink: 0;
      }
      .top-bar {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 10px;
      }
      .doc-type {
        font-size: 30px;
        font-weight: 400;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        padding-top: 2px;
      }
      .receipt-meta {
        text-align: right;
      }
      .receipt-no {
        font-size: 44px;
        font-weight: 800;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        line-height: 1.2;
      }
      .receipt-date {
        font-size: 32px;
        font-weight: 400;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        margin-top: 4px;
      }
      .brand {
        text-align: center;
        margin: 8px 0 14px;
      }
      .logo-wrap {
        display: flex;
        justify-content: center;
        align-items: center;
        margin: 0 auto;
      }
      .logo {
        display: block;
        max-width: min(92vw, 520px);
        max-height: 180px;
        width: auto;
        height: auto;
        object-fit: contain;
      }
      .gym-name {
        font-size: 84px;
        font-weight: 800;
        line-height: 1.15;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        padding: 8px 0;
      }
      .divider {
        border: none;
        border-top: 4px solid #000;
        margin: 0 0 18px;
      }
      .sections {
        display: flex;
        flex-direction: column;
        gap: 26px;
        margin-bottom: 26px;
      }
      .section {
        position: relative;
        border: 2px solid #000;
        padding: 28px 16px 18px;
        flex-shrink: 0;
      }
      .section-title {
        position: absolute;
        top: -14px;
        left: 50%;
        transform: translateX(-50%);
        background: #fff;
        padding: 0 12px;
        font-size: 40px;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .row {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: baseline;
        gap: 4px 10px;
        padding: 13px 2px;
        font-size: 46px;
        font-weight: 400;
        line-height: 1.3;
      }
      .lbl {
        flex-shrink: 0;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        font-weight: 400;
      }
      .val {
        flex: 1 1 auto;
        text-align: right;
        font-weight: 700;
        /* Keep the amount together; if it can't fit beside the label it
           wraps to its own line as a whole instead of breaking per character. */
        white-space: nowrap;
      }
      .total-box {
        border: 3px solid #000;
        text-align: center;
        padding: 18px 14px 22px;
        margin-top: 20px;
        flex-shrink: 0;
      }
      .total-label {
        font-size: 32px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin-bottom: 10px;
      }
      .total-amount {
        font-size: 88px;
        font-weight: 900;
        line-height: 1.1;
        letter-spacing: 0.01em;
        white-space: nowrap;
      }
      .disclaimer {
        border: 2px solid #000;
        text-align: center;
        padding: 14px 12px;
        margin-top: 18px;
        flex-shrink: 0;
        font-size: 34px;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      @media print {
        /* Single continuous long page so the receipt never splits across sheets. */
        @page { size: 210mm 700mm; margin: 6mm; }
        html, body {
          width: 100%;
          height: auto;
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .rcpt {
          display: block;
          width: 100%;
          margin: 0;
          padding: 3mm 4mm;
          page-break-after: avoid;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .top-bar { margin-bottom: 3mm; gap: 10px; }
        .doc-type { font-size: 34pt; padding-top: 0; }
        .receipt-no { font-size: 46pt; }
        .receipt-date { font-size: 32pt; margin-top: 1mm; }
        .brand { margin: 3mm 0 4mm; }
        .logo { max-height: 34mm; max-width: 92mm; }
        .gym-name { font-size: 64pt; padding: 2mm 0; }
        .divider { margin: 0 0 4.5mm; border-top-width: 3px; }
        .sections {
          display: block;
          gap: 0;
          margin-bottom: 5mm;
        }
        .section {
          padding: 5mm 4mm 3.5mm;
          border-width: 2px;
          margin-bottom: 5.5mm;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .section:last-child { margin-bottom: 0; }
        .total-box,
        .disclaimer,
        .row {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .section-title {
          font-size: 34pt;
          top: -3.5mm;
          padding: 0 2.5mm;
        }
        .row {
          font-size: 34pt;
          padding: 2.8mm 1px;
          gap: 3px 6px;
          line-height: 1.3;
          font-weight: 400;
          flex-wrap: wrap;
          justify-content: space-between;
        }
        .lbl { font-weight: 400; }
        .val { font-weight: 700; text-align: right; flex: 1 1 auto; white-space: nowrap; }
        .receipt-no { font-weight: 800; }
        .section-title { font-weight: 800; }
        .total-label { font-weight: 800; }
        .total-amount { font-size: 72pt; line-height: 1.05; font-weight: 900; white-space: nowrap; }
        .disclaimer { font-weight: 800; }
        .gym-name { font-weight: 800; }
        .total-box {
          padding: 4.5mm 3mm 5mm;
          margin-top: 5mm;
          border-width: 2.5px;
        }
        .total-label { font-size: 34pt; margin-bottom: 2.5mm; }
        .disclaimer {
          padding: 3.5mm 3mm;
          margin-top: 4.5mm;
          font-size: 34pt;
          border-width: 2px;
        }
      }
    </style>
  </head>
  <body>
    <div class="rcpt">
      <div class="top-bar">
        <div class="doc-type">Payment Receipt</div>
        <div class="receipt-meta">
          <div class="receipt-no">Receipt #${escapeHtml(data.receiptNumber)}</div>
          <div class="receipt-date">Date: ${escapeHtml(receiptDate)}</div>
        </div>
      </div>

      <div class="brand">
        ${logoBlock}
      </div>

      <hr class="divider" />

      <div class="sections">
        ${receiptSection('Member Information', memberRows)}
        ${receiptSection('Package Information', packageRows)}
        ${receiptSection('Payment Details', paymentRows)}
      </div>

      <div class="total-box">
        <div class="total-label">Total Payable Amount</div>
        <div class="total-amount">${escapeHtml(totalAmount)}</div>
      </div>

      <div class="disclaimer">Fees once paid is non-refundable</div>
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
        function whenReady() {
          var imgs = document.images;
          if (!imgs.length) {
            setTimeout(printOnce, 150);
            return;
          }
          var pending = imgs.length;
          function tick() {
            pending -= 1;
            if (pending <= 0) setTimeout(printOnce, 150);
          }
          for (var i = 0; i < imgs.length; i += 1) {
            if (imgs[i].complete) tick();
            else {
              imgs[i].addEventListener('load', tick);
              imgs[i].addEventListener('error', tick);
            }
          }
        }
        if (document.readyState === 'complete') whenReady();
        else window.addEventListener('load', whenReady);
      })();
    </script>
  </body>
</html>`;
}

function normalizeSignupPayment(raw: unknown): SignupPaymentReceiptSection | null {
  const row = asRecord(raw);
  if (!row) return null;
  const hasFees =
    row.admissionFee != null ||
    row.packageFee != null ||
    row.trainerFee != null ||
    row.totalAmount != null;
  if (!hasFees) return null;
  const memberDiscountRaw = row.memberDiscount;
  return {
    admissionFee: Number(row.admissionFee) || 0,
    packageFee: Number(row.packageFee) || 0,
    trainerFee: Number(row.trainerFee) || 0,
    totalAmount: Number(row.totalAmount) || 0,
    memberDiscount:
      memberDiscountRaw != null && !Number.isNaN(Number(memberDiscountRaw))
        ? Number(memberDiscountRaw)
        : null,
  };
}

function normalizeReceiptType(raw: unknown): PaymentReceiptType {
  const value = String(raw ?? 'monthly');
  if (value === 'one-time' || value === 'signup-monthly') return value;
  return 'monthly';
}

export function normalizeReceiptApiPayload(
  raw: Record<string, unknown>,
  printedBy?: PaymentReceiptPrintedBy | null
): PaymentReceiptData {
  const gym = (raw.gym as Record<string, unknown>) || {};
  const member = (raw.member as Record<string, unknown>) || {};
  const payment = (raw.payment as Record<string, unknown>) || {};
  const apiPrintedBy = raw.printedBy as Record<string, unknown> | null | undefined;
  const signupPayment = normalizeSignupPayment(pickSignupPaymentRaw(raw));
  const receiptTypeRaw = raw.receiptType ?? raw.type ?? payment.type ?? 'monthly';
  const receiptType = normalizeReceiptType(receiptTypeRaw);
  const paymentId = payment.id as string | number | undefined;
  const memberDiscount =
    member.memberDiscount != null && !Number.isNaN(Number(member.memberDiscount))
      ? Number(member.memberDiscount)
      : member.discount != null && !Number.isNaN(Number(member.discount))
        ? Number(member.discount)
        : null;
  const paymentAmount =
    receiptType === 'one-time' && signupPayment
      ? Number(signupPayment.totalAmount) || Number(payment.amount) || 0
      : Number(payment.amount) || Number(payment.monthlyInstallmentAmount) || 0;
  const nums = normalizeMemberNumberFields(member);

  return {
    receiptNumber: String(raw.receiptNumber ?? (paymentId != null ? `PAY-${paymentId}` : 'RECEIPT')),
    receiptType,
    generatedAt: String(raw.generatedAt ?? new Date().toISOString()),
    printedBy: printedBy ?? (apiPrintedBy
      ? {
          name: String(apiPrintedBy.name ?? 'Staff'),
          email: apiPrintedBy.email != null ? String(apiPrintedBy.email) : null,
          role: apiPrintedBy.role != null ? String(apiPrintedBy.role) : null,
        }
      : null),
    gym: {
      name: String(gym.name ?? ''),
      logoUrl: gym.logoUrl != null ? String(gym.logoUrl) : null,
      address: gym.address != null ? String(gym.address) : null,
      city: gym.city != null ? String(gym.city) : null,
      country: gym.country != null ? String(gym.country) : null,
      phone: gym.phone != null ? String(gym.phone) : null,
      email: gym.email != null ? String(gym.email) : null,
    },
    member: {
      id: member.id as string | number | undefined,
      memberNumber: nums.memberNumber,
      legacyMemberId: nums.legacyMemberId,
      name: String(member.name ?? ''),
      email: member.email != null ? String(member.email) : null,
      phone: member.phone != null ? String(member.phone) : null,
      cnic: member.cnic != null ? String(member.cnic) : null,
      membershipStart: member.membershipStart != null ? String(member.membershipStart) : null,
      membershipEnd: member.membershipEnd != null ? String(member.membershipEnd) : null,
      monthlyPaymentAmount:
        member.monthlyPaymentAmount != null ? Number(member.monthlyPaymentAmount) : null,
      memberDiscount,
      isActive: member.isActive !== false,
    },
    package: normalizePackage(raw.package),
    trainers: normalizeTrainers(raw.trainers),
    signupPayment,
    payment: {
      id: paymentId,
      month: payment.month != null ? String(payment.month) : '',
      amount: paymentAmount,
      monthlyInstallmentAmount:
        payment.monthlyInstallmentAmount != null
          ? Number(payment.monthlyInstallmentAmount)
          : null,
      status: String(payment.status ?? 'PAID'),
      dueDate: payment.dueDate != null ? String(payment.dueDate) : '',
      paidDate: payment.paidDate != null ? String(payment.paidDate) : null,
    },
  };
}

export async function fetchPaymentReceiptData(
  paymentId: string | number,
  printedBy?: PaymentReceiptPrintedBy | null,
  memberId?: string | number,
  hints?: ReceiptEnrichmentHints | null
): Promise<PaymentReceiptData> {
  const response = await api.get(`/api/payments/${paymentId}/receipt`);
  if (!response.data?.success) {
    throw new Error(response.data?.error?.message || 'Failed to load receipt data');
  }
  const raw = response.data.data as Record<string, unknown>;
  const base = normalizeReceiptApiPayload(raw, printedBy);
  const resolvedMemberId = memberId ?? base.member.id;
  const enriched = await enrichReceiptFromMember(base, resolvedMemberId);
  return applyReceiptEnrichment(enriched, hints);
}

export async function fetchOneTimePaymentReceiptData(
  oneTimePaymentId: string | number,
  printedBy?: PaymentReceiptPrintedBy | null,
  memberId?: string | number,
  hints?: ReceiptEnrichmentHints | null
): Promise<PaymentReceiptData> {
  const response = await api.get(`/api/payments/one-time/${oneTimePaymentId}/receipt`);
  if (!response.data?.success) {
    throw new Error(response.data?.error?.message || 'Failed to load signup receipt data');
  }
  const raw = response.data.data as Record<string, unknown>;
  let base = normalizeReceiptApiPayload(raw, printedBy);
  if (base.receiptType !== 'one-time') {
    base = { ...base, receiptType: 'one-time' };
  }
  if (!base.signupPayment) {
    const fallbackSignup = normalizeSignupPayment(pickSignupPaymentRaw(raw));
    if (fallbackSignup) {
      base = { ...base, signupPayment: fallbackSignup };
    }
  }
  const resolvedMemberId = memberId ?? base.member.id;
  const enriched = await enrichReceiptFromMember(base, resolvedMemberId);
  return applyReceiptEnrichment(enriched, hints);
}

export function openPaymentReceiptPrintWindow(html: string): Window | null {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    return null;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  return printWindow;
}

export async function printPaymentReceipt(
  paymentId: string | number,
  printedBy?: PaymentReceiptPrintedBy | null,
  memberId?: string | number,
  hints?: ReceiptEnrichmentHints | null
): Promise<void> {
  const data = await fetchPaymentReceiptData(paymentId, printedBy, memberId, hints);
  const html = buildPaymentReceiptHtml(data);
  const win = openPaymentReceiptPrintWindow(html);
  if (!win) {
    throw new Error('Allow popups to print receipts.');
  }
}

export async function printOneTimePaymentReceipt(
  oneTimePaymentId: string | number,
  printedBy?: PaymentReceiptPrintedBy | null,
  memberId?: string | number,
  hints?: ReceiptEnrichmentHints | null
): Promise<void> {
  const data = await fetchOneTimePaymentReceiptData(oneTimePaymentId, printedBy, memberId, hints);
  const html = buildPaymentReceiptHtml(data);
  const win = openPaymentReceiptPrintWindow(html);
  if (!win) {
    throw new Error('Allow popups to print receipts.');
  }
}

function formatWhatsAppMoney(amount: number | null | undefined): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return 'Rs. 0';
  const hasFraction = Math.abs(n % 1) > 1e-9;
  return `Rs. ${n.toLocaleString('en-US', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  })}`;
}

/** Professional short WhatsApp text for a membership/signup payment receipt. */
export function buildPaymentReceiptWhatsAppMessage(data: PaymentReceiptData): string {
  const gym = (data.gym.name || '').trim() || 'your gym';
  const member = (data.member.name || '').trim();
  const greeting = member ? `Dear ${member},` : 'Dear Member,';
  const amount = formatWhatsAppMoney(resolveReceiptPaymentAmount(data));
  const paidOn = formatReceiptDate(data.payment.paidDate || data.generatedAt);

  const lines = [
    greeting,
    '',
    `Thank you for your payment to ${gym}.`,
    '',
    `Receipt: ${data.receiptNumber}`,
    `Amount paid: ${amount}`,
  ];

  if (isSignupReceipt(data)) {
    lines.push('Payment: Membership signup');
  } else if (data.payment.month) {
    lines.push(`Billing month: ${formatReceiptMonthFull(data.payment.month)}`);
  }

  if (data.package?.name) {
    lines.push(`Package: ${data.package.name}`);
  }

  lines.push(`Paid on: ${paidOn}`, '', 'We look forward to seeing you at the gym.', `— ${gym}`);
  return lines.join('\n');
}

/** Full receipt details as plain text (appended when a file cannot be attached automatically). */
export function buildPaymentReceiptWhatsAppFullText(data: PaymentReceiptData): string {
  const amount = formatWhatsAppMoney(resolveReceiptPaymentAmount(data));
  const paidOn = formatReceiptDate(data.payment.paidDate || data.generatedAt);
  const lines = [
    '—— Full receipt ——',
    `Receipt #: ${data.receiptNumber}`,
    `Gym: ${(data.gym.name || '').trim() || '—'}`,
    `Member ID: ${displayMemberId(data.member)}`,
    `Member: ${data.member.name || '—'}`,
    `Phone: ${data.member.phone || '—'}`,
  ];

  if (data.package?.name) {
    lines.push(`Package: ${data.package.name}`);
    if (data.package.startDate) lines.push(`Start: ${formatReceiptDate(data.package.startDate)}`);
    if (data.package.expiryDate) lines.push(`Expiry: ${formatReceiptDate(data.package.expiryDate)}`);
  }

  if (isSignupReceipt(data) && data.signupPayment) {
    const signup = data.signupPayment;
    lines.push('Type: Membership signup');
    lines.push(`Admission: ${formatWhatsAppMoney(signup.admissionFee)}`);
    lines.push(`Package fee: ${formatWhatsAppMoney(signup.packageFee)}`);
    if (signup.trainerFee > 0) lines.push(`Trainer: ${formatWhatsAppMoney(signup.trainerFee)}`);
    const discount = resolveReceiptMemberDiscountAmount(data);
    if (discount > 0) lines.push(`Discount: -${formatWhatsAppMoney(discount)}`);
  } else if (data.payment.month) {
    lines.push(`Billing month: ${formatReceiptMonthFull(data.payment.month)}`);
  }

  lines.push(`Amount paid: ${amount}`, `Paid on: ${paidOn}`);
  return lines.join('\n');
}

function openPaymentReceiptWhatsAppChat(message: string, phone?: string | null): void {
  const normalized = normalizeWhatsAppPhone(phone);
  const url = normalized
    ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export type PaymentReceiptWhatsAppShareResult = {
  /** WhatsApp chat was opened with the receipt message. */
  openedChat: boolean;
};

/** Opens WhatsApp with the payment receipt message (text only). */
export function sharePaymentReceiptOnWhatsApp(
  data: PaymentReceiptData,
  phone?: string | null
): PaymentReceiptWhatsAppShareResult {
  const message = buildPaymentReceiptWhatsAppMessage(data);
  const resolvedPhone = phone ?? data.member.phone ?? null;
  openPaymentReceiptWhatsAppChat(message, resolvedPhone);
  return { openedChat: true };
}

/** Opens WhatsApp with receipt text. Uses phone when available; otherwise opens the chat picker. */
export function openPaymentReceiptWhatsApp(
  data: PaymentReceiptData,
  phone?: string | null
): boolean {
  sharePaymentReceiptOnWhatsApp(data, phone);
  return true;
}

export async function fetchPaymentReceiptForWhatsApp(
  kind: 'monthly' | 'one-time',
  id: string | number,
  printedBy?: PaymentReceiptPrintedBy | null,
  memberId?: string | number,
  hints?: ReceiptEnrichmentHints | null
): Promise<PaymentReceiptData> {
  if (kind === 'one-time') {
    return fetchOneTimePaymentReceiptData(id, printedBy, memberId, hints);
  }
  return fetchPaymentReceiptData(id, printedBy, memberId, hints);
}

import api from '@/lib/api';
import { formatDate } from '@/lib/dateUtils';

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
    id?: string | number;
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
  if (Number.isNaN(n)) return 'Rs. 0.00';
  return `Rs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function resolveGymLogoUrl(logoUrl?: string | null): string | null {
  if (!logoUrl?.trim()) return null;
  const u = logoUrl.trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('/')) {
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
    if (apiBase) return `${apiBase}${u}`;
    if (typeof window !== 'undefined') return `${window.location.origin}${u}`;
    return u;
  }
  return u;
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
  rows += receiptBoxRowOptional('COVERAGE START', data.package?.startDate);
  rows += receiptBoxRowOptional('COVERAGE EXPIRY', data.package?.expiryDate);
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

  if (
    !needsPackage &&
    !needsTrainers &&
    !needsTrainerCharges &&
    !needsPackageFeatures &&
    !needsMemberDiscount
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
    rows += receiptBoxRow('PAYMENT TYPE', 'Signup / one-time');
    if (signup.admissionFee) {
      rows += receiptBoxRow('ADMISSION FEE', formatMoney(signup.admissionFee));
    }
    if (signup.packageFee) {
      rows += receiptBoxRow('PACKAGE (1ST MONTH)', formatMoney(signup.packageFee));
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
    rows += receiptBoxRow('PAYMENT MONTH', formatReceiptMonthFull(data.payment.month));
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
    receiptBoxRow('MEMBER ID', data.member.id) +
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
        font-size: 15px;
        font-weight: 400;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        padding-top: 2px;
      }
      .receipt-meta {
        text-align: right;
      }
      .receipt-no {
        font-size: 22px;
        font-weight: 800;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        line-height: 1.2;
      }
      .receipt-date {
        font-size: 16px;
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
        font-size: 42px;
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
        gap: 20px;
        margin-bottom: 20px;
      }
      .section {
        position: relative;
        border: 2px solid #000;
        padding: 22px 14px 14px;
        flex-shrink: 0;
      }
      .section-title {
        position: absolute;
        top: -13px;
        left: 50%;
        transform: translateX(-50%);
        background: #fff;
        padding: 0 12px;
        font-size: 17px;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12px;
        padding: 12px 2px;
        font-size: 23px;
        font-weight: 400;
        line-height: 1.25;
      }
      .lbl {
        flex-shrink: 0;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        font-weight: 400;
      }
      .val {
        flex-shrink: 0;
        text-align: right;
        font-weight: 400;
        word-break: break-word;
        max-width: 58%;
      }
      .total-box {
        border: 3px solid #000;
        text-align: center;
        padding: 18px 14px 22px;
        margin-top: 20px;
        flex-shrink: 0;
      }
      .total-label {
        font-size: 16px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin-bottom: 10px;
      }
      .total-amount {
        font-size: 56px;
        font-weight: 900;
        line-height: 1.15;
        letter-spacing: 0.01em;
      }
      .disclaimer {
        border: 2px solid #000;
        text-align: center;
        padding: 14px 12px;
        margin-top: 18px;
        flex-shrink: 0;
        font-size: 17px;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      @media print {
        @page { size: A4 portrait; margin: 4mm; }
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
        .top-bar { margin-bottom: 2mm; gap: 10px; }
        .doc-type { font-size: 11pt; padding-top: 0; }
        .receipt-no { font-size: 15pt; }
        .receipt-date { font-size: 10.5pt; margin-top: 0.5mm; }
        .brand { margin: 2mm 0 2.5mm; }
        .logo { max-height: 24mm; max-width: 72mm; }
        .gym-name { font-size: 22pt; padding: 1.5mm 0; }
        .divider { margin: 0 0 3mm; border-top-width: 3px; }
        .sections {
          display: block;
          gap: 0;
          margin-bottom: 3mm;
        }
        .section {
          padding: 3.5mm 3mm 2mm;
          border-width: 2px;
          margin-bottom: 3.5mm;
        }
        .section:last-child { margin-bottom: 0; }
        .section-title {
          font-size: 11pt;
          top: -2.5mm;
          padding: 0 2mm;
        }
        .row {
          font-size: 13pt;
          padding: 1.4mm 1px;
          gap: 8px;
          line-height: 1.25;
          font-weight: 400;
        }
        .lbl, .val { font-weight: 400; }
        .receipt-no { font-weight: 800; }
        .section-title { font-weight: 800; }
        .total-label { font-weight: 800; }
        .total-amount { font-size: 32pt; line-height: 1.1; font-weight: 900; }
        .disclaimer { font-weight: 800; }
        .gym-name { font-weight: 800; }
        .total-box {
          padding: 3mm 3mm 3.5mm;
          margin-top: 3.5mm;
          border-width: 2.5px;
        }
        .total-label { font-size: 11pt; margin-bottom: 1.5mm; }
        .disclaimer {
          padding: 2.5mm 3mm;
          margin-top: 3mm;
          font-size: 11pt;
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

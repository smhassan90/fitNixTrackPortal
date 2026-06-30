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
  return `Rs. ${n.toFixed(2)}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatDate(iso);
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMonthShort(monthKey: string): string {
  const [y, m] = monthKey.split('-').map((x) => parseInt(x, 10));
  if (!y || !m) return monthKey;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString(undefined, { month: 'short', year: 'numeric' });
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

function gymLocationLine(gym: PaymentReceiptData['gym']): string {
  return [gym.address, gym.city, gym.country].filter(Boolean).join(', ');
}

function humanizeRole(role?: string | null): string {
  if (!role) return 'Staff';
  return role
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function optionalRow(label: string, value: unknown): string {
  if (value == null || String(value).trim() === '') return '';
  return `<div class="r"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function featuresInline(features: string[]): string {
  return features.map((f) => escapeHtml(f)).join(' · ');
}

function buildAvailedServicesBlock(data: PaymentReceiptData): string {
  const pkg = data.package;
  const trainers = data.trainers;
  let rows = '';

  if (pkg) {
    rows += optionalRow('Package', `${pkg.name} (${pkg.duration})`);
    rows += optionalRow('Package fee', `${formatMoney(packageNetMonthly(pkg))}/mo`);
    if (pkg.features && pkg.features.length > 0) {
      rows += optionalRow('Includes', featuresInline(pkg.features));
    }
  } else {
    rows += optionalRow('Package', 'Not availed');
  }

  if (trainers.length > 0) {
    trainers.forEach((t, i) => {
      const label = trainers.length > 1 ? `Trainer ${i + 1}` : 'Trainer';
      const chargePart =
        t.charges != null && !Number.isNaN(Number(t.charges))
          ? `${t.name} (${formatMoney(t.charges)}/mo)`
          : t.name;
      rows += optionalRow(label, chargePart);
    });
  } else {
    rows += optionalRow('Trainer', 'Not assigned');
  }

  return `<div class="block"><h4>Availed services</h4><dl class="rows">${rows}</dl></div>`;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
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
  if (!needsPackage && !needsTrainers && !needsTrainerCharges && !needsPackageFeatures) return data;

  try {
    const res = await api.get(`/api/members/${memberId}`);
    if (!res.data?.success) return data;
    const root = asRecord(res.data.data);
    if (!root) return data;
    const m = asRecord(root.member) ?? root;

    let pkg = data.package;
    const packageId = m.packageId ?? asRecord(m.package)?.id;
    if (packageId != null) {
      try {
        const pRes = await api.get(`/api/packages/${packageId}`);
        if (pRes.data?.success) {
          const full = normalizePackage(pRes.data.data?.package ?? pRes.data.data);
          if (full) pkg = full;
        }
      } catch {
        if (!pkg && m.package) pkg = normalizePackage(m.package);
      }
    } else if (!pkg && m.package) {
      pkg = normalizePackage(m.package);
    }

    const trainers =
      data.trainers.length > 0 && !needsTrainerCharges
        ? data.trainers
        : normalizeTrainers(m.trainers);

    return { ...data, package: pkg, trainers };
  } catch {
    return data;
  }
}

function buildAmountBreakdown(data: PaymentReceiptData): string {
  const signup = data.signupPayment;
  if (signup) {
    const memberDiscount =
      Number(signup.memberDiscount ?? data.member.memberDiscount) || 0;
    let rows = '';

    if (signup.admissionFee > 0) {
      rows += `<div class="r"><dt>Admission fee</dt><dd>${formatMoney(signup.admissionFee)}</dd></div>`;
    }
    if (signup.packageFee > 0) {
      rows += `<div class="r"><dt>Package (1st month)</dt><dd>${formatMoney(signup.packageFee)}</dd></div>`;
    }
    if (signup.trainerFee > 0) {
      rows += `<div class="r"><dt>Trainer fee</dt><dd>${formatMoney(signup.trainerFee)}</dd></div>`;
    }
    if (memberDiscount > 0) {
      rows += `<div class="r"><dt>Member discount</dt><dd>- ${formatMoney(memberDiscount)}</dd></div>`;
    }
    rows += `<div class="total">
    <span>Received</span>
    <span>${formatMoney(data.payment.amount)}</span>
  </div>`;
    if (
      data.receiptType === 'signup-monthly' &&
      data.payment.monthlyInstallmentAmount != null &&
      data.payment.monthlyInstallmentAmount > 0 &&
      Math.abs(data.payment.monthlyInstallmentAmount - data.payment.amount) > 0.009
    ) {
      rows += `<div class="r" style="margin-top:6px"><dt class="muted">Monthly installment</dt><dd>${formatMoney(data.payment.monthlyInstallmentAmount)}</dd></div>`;
    }
    return rows;
  }

  const pkg = data.package;
  const pkgNetMonthly = pkg ? packageNetMonthly(pkg) : null;
  const memberDiscount = Number(data.member.memberDiscount) || 0;
  const trainers = data.trainers;
  let rows = '';

  if (pkg) {
    rows += `<div class="r"><dt>Package fee</dt><dd>${formatMoney(pkgNetMonthly ?? 0)}</dd></div>`;
  }

  if (trainers.length > 0) {
    trainers.forEach((t) => {
      const label =
        trainers.length > 1 ? `Trainer fee (${t.name})` : `Trainer fee${t.name ? ` (${t.name})` : ''}`;
      const fee = t.charges != null && !Number.isNaN(Number(t.charges)) ? Number(t.charges) : 0;
      rows += `<div class="r"><dt>${escapeHtml(label)}</dt><dd>${formatMoney(fee)}</dd></div>`;
    });
  }

  if (memberDiscount > 0) {
    rows += `<div class="r"><dt>Member discount</dt><dd>- ${formatMoney(memberDiscount)}</dd></div>`;
  }

  rows += `<div class="total">
    <span>Received</span>
    <span>${formatMoney(data.payment.amount)}</span>
  </div>`;

  return rows;
}

export function buildPaymentReceiptHtml(data: PaymentReceiptData): string {
  const logoUrl = resolveGymLogoUrl(data.gym.logoUrl);
  const location = gymLocationLine(data.gym);
  const availedBlock = buildAvailedServicesBlock(data);
  const amountRows = buildAmountBreakdown(data);
  const gymContact = [
    location,
    data.gym.phone ? `Tel ${data.gym.phone}` : '',
    data.gym.email || '',
  ]
    .filter(Boolean)
    .join(' · ');

  const printedByLine = data.printedBy
    ? `${data.printedBy.name}${data.printedBy.role ? ` (${humanizeRole(data.printedBy.role)})` : ''}`
    : '—';

  const memberRows =
    optionalRow('ID', data.member.id) +
    optionalRow('Name', data.member.name) +
    optionalRow('Phone', data.member.phone) +
    optionalRow('CNIC', data.member.cnic) +
    optionalRow('Status', data.member.isActive === false ? 'Inactive' : 'Active') +
    optionalRow(
      'Monthly fee',
      data.member.monthlyPaymentAmount != null ? formatMoney(data.member.monthlyPaymentAmount) : null
    );

  const paymentRows =
    data.receiptType === 'one-time'
      ? optionalRow('Type', 'Signup / one-time payment') +
        optionalRow('Paid', formatDate(data.payment.paidDate || data.generatedAt)) +
        optionalRow('Status', data.payment.status)
      : optionalRow('Month', formatMonthShort(data.payment.month)) +
        optionalRow('Due', data.payment.dueDate ? formatDate(data.payment.dueDate) : null) +
        optionalRow('Paid', formatDate(data.payment.paidDate || data.payment.dueDate)) +
        optionalRow('Status', data.payment.status);

  const receiptSubtitle =
    data.receiptType === 'one-time'
      ? 'Signup / one-time payment receipt'
      : data.receiptType === 'signup-monthly'
        ? 'Membership receipt (includes signup)'
        : 'Payment receipt';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Receipt ${escapeHtml(data.receiptNumber)}</title>
    <style>
      @media print {
        @page { size: A4 portrait; margin: 4mm; }
        html, body {
          width: 100%;
          height: auto !important;
          min-height: 0 !important;
          margin: 0;
          padding: 0;
          overflow: visible;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .rcpt {
          display: block !important;
          width: 100% !important;
          max-width: none !important;
          min-height: 0 !important;
          height: auto !important;
          border: none;
          border-radius: 0;
          page-break-after: avoid;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .logo-bar { padding: 8px 12px 6px !important; }
        .logo-bar img { max-height: 56px !important; max-width: 56px !important; }
        .head { padding: 10px 12px !important; }
        .head .gym { font-size: 30px !important; }
        .head .meta { font-size: 15px !important; margin-top: 3px !important; }
        .strip { padding: 8px 12px !important; font-size: 16px !important; }
        .strip strong { font-size: 18px !important; }
        .badge { font-size: 14px !important; padding: 4px 10px !important; }
        .body { padding: 10px 12px 6px !important; display: block !important; }
        .cols { gap: 10px 14px !important; margin-bottom: 10px !important; }
        .block h4 { font-size: 14px !important; margin-bottom: 5px !important; padding-bottom: 4px !important; }
        .rows { gap: 3px !important; }
        .r { font-size: 17px !important; padding: 2px 0 !important; line-height: 1.35 !important; }
        .amt { padding: 10px 12px !important; margin-top: 8px !important; }
        .amt .r { font-size: 17px !important; padding: 3px 0 !important; }
        .amt .total { font-size: 26px !important; margin-top: 8px !important; padding-top: 8px !important; }
        .foot {
          margin-top: 8px !important;
          padding: 8px 12px 4px !important;
          font-size: 14px !important;
          line-height: 1.35 !important;
          page-break-before: avoid !important;
          break-before: avoid-page !important;
        }
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body {
        width: 100%;
        height: auto;
        min-height: 0;
      }
      body {
        font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
        font-size: 21px;
        line-height: 1.5;
        color: #111;
        background: #fff;
        margin: 0;
        padding: 0;
      }
      .rcpt {
        display: flex;
        flex-direction: column;
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
        border: 1px solid #ddd;
        overflow: hidden;
      }
      .logo-bar {
        text-align: center;
        padding: 18px 20px 12px;
        background: #fff;
        border-bottom: 1px solid #e5e7eb;
      }
      .logo-bar img {
        display: block;
        margin: 0 auto;
        max-width: 100px;
        max-height: 100px;
        width: auto;
        height: auto;
        object-fit: contain;
      }
      .head {
        text-align: center;
        padding: 16px 20px;
        background: #111827;
        color: #fff;
      }
      .head .gym { font-size: 40px; font-weight: 700; }
      .head .meta { font-size: 18px; color: #cbd5e1; margin-top: 6px; }
      .strip {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 12px 20px;
        background: #f3f4f6;
        border-bottom: 1px solid #e5e7eb;
        font-size: 20px;
      }
      .strip strong { font-size: 22px; }
      .badge {
        font-size: 16px;
        font-weight: 700;
        padding: 6px 12px;
        border-radius: 4px;
        background: #059669;
        color: #fff;
        white-space: nowrap;
      }
      .body {
        display: flex;
        flex-direction: column;
        padding: 18px 20px;
      }
      .cols {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 18px 24px;
        margin-bottom: 18px;
      }
      .block h4 {
        font-size: 15px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #6b7280;
        margin-bottom: 8px;
        padding-bottom: 6px;
        border-bottom: 1px solid #e5e7eb;
      }
      .rows { display: flex; flex-direction: column; gap: 4px; }
      .r {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        font-size: 20px;
        padding: 4px 0;
      }
      .r dt { color: #6b7280; flex-shrink: 0; }
      .r dd { text-align: right; font-weight: 500; word-break: break-word; }
      .amt {
        margin-top: 14px;
        padding: 16px 18px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
      }
      .amt .r { font-size: 21px; padding: 5px 0; }
      .amt .total {
        display: flex;
        justify-content: space-between;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 2px solid #111;
        font-size: 34px;
        font-weight: 700;
      }
      .foot {
        margin-top: 14px;
        padding: 12px 20px 16px;
        border-top: 1px dashed #d1d5db;
        font-size: 17px;
        color: #6b7280;
        text-align: center;
        line-height: 1.45;
      }
    </style>
  </head>
  <body>
    <div class="rcpt">
      ${logoUrl ? `<div class="logo-bar"><img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(data.gym.name)} logo" /></div>` : ''}
      <div class="head">
        <div class="gym">${escapeHtml(data.gym.name || 'Gym')}</div>
        ${gymContact ? `<div class="meta">${escapeHtml(gymContact)}</div>` : ''}
        <div class="meta" style="margin-top:4px">${escapeHtml(receiptSubtitle)}</div>
      </div>

      <div class="strip">
        <span><strong>${escapeHtml(data.receiptNumber)}</strong></span>
        <span>ID ${escapeHtml(data.payment.id ?? data.payment.month)}</span>
        <span class="badge">${escapeHtml(data.payment.status)}</span>
      </div>

      <div class="body">
        <div class="cols">
          <div class="block">
            <h4>Payment</h4>
            <dl class="rows">${paymentRows}</dl>
          </div>
          <div class="block">
            <h4>Member</h4>
            <dl class="rows">${memberRows}</dl>
          </div>
        </div>

        ${availedBlock}

        <div class="amt">
          ${amountRows}
        </div>

        <div class="foot">
          By ${escapeHtml(printedByLine)} · ${escapeHtml(formatDateTime(data.generatedAt))}<br />
          Thank you — retain for your records
        </div>
      </div>
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
  return {
    admissionFee: Number(row.admissionFee) || 0,
    packageFee: Number(row.packageFee) || 0,
    trainerFee: Number(row.trainerFee) || 0,
    totalAmount: Number(row.totalAmount) || 0,
    memberDiscount: row.memberDiscount != null ? Number(row.memberDiscount) : null,
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
  const signupPayment = normalizeSignupPayment(raw.signupPayment);
  const receiptType = normalizeReceiptType(raw.receiptType);
  const paymentId = payment.id as string | number | undefined;

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
      memberDiscount: member.memberDiscount != null ? Number(member.memberDiscount) : null,
      isActive: member.isActive !== false,
    },
    package: normalizePackage(raw.package),
    trainers: normalizeTrainers(raw.trainers),
    signupPayment,
    payment: {
      id: paymentId,
      month: payment.month != null ? String(payment.month) : '',
      amount: Number(payment.amount) || 0,
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
  memberId?: string | number
): Promise<PaymentReceiptData> {
  const response = await api.get(`/api/payments/${paymentId}/receipt`);
  if (!response.data?.success) {
    throw new Error(response.data?.error?.message || 'Failed to load receipt data');
  }
  const raw = response.data.data as Record<string, unknown>;
  const base = normalizeReceiptApiPayload(raw, printedBy);
  const resolvedMemberId = memberId ?? base.member.id;
  return enrichReceiptFromMember(base, resolvedMemberId);
}

export async function fetchOneTimePaymentReceiptData(
  oneTimePaymentId: string | number,
  printedBy?: PaymentReceiptPrintedBy | null,
  memberId?: string | number
): Promise<PaymentReceiptData> {
  const response = await api.get(`/api/payments/one-time/${oneTimePaymentId}/receipt`);
  if (!response.data?.success) {
    throw new Error(response.data?.error?.message || 'Failed to load signup receipt data');
  }
  const raw = response.data.data as Record<string, unknown>;
  const base = normalizeReceiptApiPayload(raw, printedBy);
  const resolvedMemberId = memberId ?? base.member.id;
  return enrichReceiptFromMember(base, resolvedMemberId);
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
  memberId?: string | number
): Promise<void> {
  const data = await fetchPaymentReceiptData(paymentId, printedBy, memberId);
  const html = buildPaymentReceiptHtml(data);
  const win = openPaymentReceiptPrintWindow(html);
  if (!win) {
    throw new Error('Allow popups to print receipts.');
  }
}

export async function printOneTimePaymentReceipt(
  oneTimePaymentId: string | number,
  printedBy?: PaymentReceiptPrintedBy | null,
  memberId?: string | number
): Promise<void> {
  const data = await fetchOneTimePaymentReceiptData(oneTimePaymentId, printedBy, memberId);
  const html = buildPaymentReceiptHtml(data);
  const win = openPaymentReceiptPrintWindow(html);
  if (!win) {
    throw new Error('Allow popups to print receipts.');
  }
}

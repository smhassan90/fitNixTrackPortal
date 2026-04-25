'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  activatePlatformGym,
  getPlatformLocationsCatalog,
  getPlatformGym,
  patchPlatformGym,
  patchPlatformGymSubscription,
  listPlatformBillingPlans,
  recordPlatformGymPayment,
  suspendPlatformGym,
} from '@/lib/platform/platformApi';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import { patchGymProfileSchema, patchSubscriptionSchema } from '@/lib/platform/validation';
import { useIsPlatformSuperAdmin } from '@/contexts/PlatformAuthContext';
import Loading from '@/components/Loading';
import PlatformLogoUpload from '@/components/platform/PlatformLogoUpload';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import Alert from '@/components/Alert';
import { useAlert } from '@/hooks/useAlert';
import { gymProfileSummary } from '@/lib/platform/presentation';
import { normalizeBillingPlans, type BillingPlanOption } from '@/lib/platform/billingPlans';
import {
  DEFAULT_COUNTRY,
  LOCATION_CATALOG,
  getCitiesForCountry,
  getSupportedCountries,
  normalizeLocationCatalog,
  withFallbackCatalog,
  type LocationCatalog,
} from '@/lib/platform/locationCatalog';

type Tab = 'overview' | 'subscription' | 'activity';

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Profile',
  subscription: 'Billing',
  activity: 'History',
};

const PROFILE_FIELDS: { key: 'name' | 'slug' | 'address' | 'phone' | 'email'; label: string }[] = [
  { key: 'name', label: 'Gym name' },
  { key: 'slug', label: 'Web address key' },
  { key: 'address', label: 'Street address' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
];

export default function PlatformGymDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const isSuper = useIsPlatformSuperAdmin();
  const { alert, showAlert, closeAlert } = useAlert();
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [gym, setGym] = useState<Record<string, unknown> | null>(null);
  const [confirm, setConfirm] = useState<'suspend' | 'activate' | null>(null);

  const [profileDraft, setProfileDraft] = useState({
    name: '',
    slug: '',
    logoUrl: '',
    address: '',
    city: '',
    country: '',
    phone: '',
    email: '',
  });
  const [subDraft, setSubDraft] = useState({
    planId: '',
    dueDate: '',
    markPaidAt: '',
    notes: '',
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState({
    amount: '',
    currency: 'PKR',
    paidAt: '',
    method: 'CASH',
    notes: '',
  });
  const [lastReceipt, setLastReceipt] = useState<{
    receiptNo: string;
    gymName: string;
    packageName: string;
    amount: string;
    currency: string;
    paidAt: string;
    method: string;
    notes: string;
  } | null>(null);
  const [plans, setPlans] = useState<BillingPlanOption[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [locationCatalog, setLocationCatalog] = useState<LocationCatalog>(LOCATION_CATALOG);
  const countryOptions = getSupportedCountries(locationCatalog);
  const cityOptions = getCitiesForCountry(profileDraft.country || DEFAULT_COUNTRY, locationCatalog);
  const planNameById = useMemo(() => {
    const map = new Map<string, string>();
    plans.forEach((p) => {
      const nameOnly = p.label.split(' - ')[0]?.trim() || p.label;
      if (p.id) map.set(String(p.id), nameOnly);
    });
    return map;
  }, [plans]);
  const currentPlanName = useMemo(() => {
    const gymObj = gym as Record<string, unknown> | null;
    const sub = (gymObj?.subscription as Record<string, unknown> | undefined) ?? {};
    const fromName = String(
      sub.planName ?? sub.packageName ?? gymObj?.planName ?? gymObj?.packageName ?? ''
    ).trim();
    if (fromName && fromName.toLowerCase() !== 'null' && fromName.toLowerCase() !== 'undefined') return fromName;
    const subPlanId = sub.planId ?? gymObj?.planId;
    if (subPlanId != null) {
      const mapped = planNameById.get(String(subPlanId));
      if (mapped) return mapped;
    }
    return '—';
  }, [gym, planNameById]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await getPlatformGym(id)) as Record<string, unknown>;
      setGym(data);
      setProfileDraft({
        name: String(data.name ?? ''),
        slug: String(data.slug ?? ''),
        logoUrl: String(data.logoUrl ?? ''),
        address: String(data.address ?? ''),
        city: String(data.city ?? ''),
        country: String(data.country ?? DEFAULT_COUNTRY),
        phone: String(data.phone ?? ''),
        email: String(data.email ?? ''),
      });
      const sub = (data.subscription as Record<string, unknown>) || {};
      setSubDraft({
        planId: sub.planId != null ? String(sub.planId) : '',
        dueDate: String(sub.dueDate ?? '').slice(0, 10),
        markPaidAt: '',
        notes: '',
      });
    } catch (e) {
      showAlert('error', 'Load failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id, showAlert]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let active = true;
    const loadLocations = async () => {
      try {
        const remotePayload = await getPlatformLocationsCatalog();
        const remoteCatalog = normalizeLocationCatalog(remotePayload);
        if (!active) return;
        const merged = withFallbackCatalog(remoteCatalog);
        setLocationCatalog(merged);
        const supportedCountries = getSupportedCountries(merged);
        const fallbackCountry = supportedCountries.includes(DEFAULT_COUNTRY)
          ? DEFAULT_COUNTRY
          : (supportedCountries[0] ?? DEFAULT_COUNTRY);
        setProfileDraft((prev) => {
          const nextCountry = supportedCountries.includes(prev.country) ? prev.country : fallbackCountry;
          const nextCities = getCitiesForCountry(nextCountry, merged);
          const nextCity = nextCities.includes(prev.city) ? prev.city : '';
          return { ...prev, country: nextCountry, city: nextCity };
        });
      } catch {
        if (!active) return;
        setLocationCatalog(LOCATION_CATALOG);
      }
    };
    loadLocations();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadPlans = async () => {
      setPlansLoading(true);
      try {
        const data = await listPlatformBillingPlans({ active: 'true' });
        if (!active) return;
        const nextPlans = normalizeBillingPlans(data);
        setPlans(nextPlans);
      } catch {
        if (!active) return;
        setPlans([]);
      } finally {
        if (active) setPlansLoading(false);
      }
    };
    loadPlans();
    return () => {
      active = false;
    };
  }, []);

  const tenantStatus = String(gym?.tenantStatus ?? gym?.status ?? '').toUpperCase();
  const suspended = tenantStatus === 'SUSPENDED';
  const billingHistoryRows = useMemo(() => {
    const sub = (gym?.subscription as Record<string, unknown> | undefined) ?? {};
    const rawHistory = gym?.billingHistory ?? sub.paymentHistory ?? sub.history ?? [];
    if (!Array.isArray(rawHistory)) return [];
    return rawHistory
      .map((entry, index) => {
        if (!entry || typeof entry !== 'object') return null;
        const row = entry as Record<string, unknown>;
        const date = String(row.paidAt ?? row.markPaidAt ?? row.date ?? row.createdAt ?? '').slice(0, 10) || '—';
        const amount = String(
          row.amountPaid ?? row.amount ?? row.amountCollected ?? row.collectedAmount ?? row.paidAmount ?? row.receivedAmount ?? '—'
        );
        const currency = String(row.currency ?? 'PKR');
        const status = String(row.status ?? row.paymentStatus ?? '—');
        const note = String(row.note ?? row.notes ?? row.description ?? '').trim();
        const receiptNo = String(row.receiptNo ?? row.receiptNumber ?? row.receipt_id ?? '').trim();
        const method = String(row.method ?? row.paymentMethod ?? '—');
        const rowPlan = row.plan && typeof row.plan === 'object' ? (row.plan as Record<string, unknown>) : undefined;
        const rowPackage = row.package && typeof row.package === 'object' ? (row.package as Record<string, unknown>) : undefined;
        const rowPlanId = row.planId ?? row.subscriptionPlanId ?? rowPackage?.id ?? rowPlan?.id;
        const packageCandidate =
          row.planName ??
          row.packageName ??
          row.subscriptionPlanName ??
          rowPlan?.name ??
          rowPackage?.name ??
          (rowPlanId != null ? planNameById.get(String(rowPlanId)) : undefined) ??
          sub.planName ??
          sub.packageName ??
          currentPlanName;
        const packageText = packageCandidate == null ? '' : String(packageCandidate).trim();
        const packageName =
          packageText && packageText.toLowerCase() !== 'null' && packageText.toLowerCase() !== 'undefined'
            ? packageText
            : currentPlanName;
        return {
          key: String(row.id ?? `${date}-${amount}-${index}`),
          date,
          amount,
          currency,
          status,
          receiptNo: receiptNo || '—',
          method,
          packageName,
          note: note || '—',
        };
      })
      .filter(
        (
          v
        ): v is {
          key: string;
          date: string;
          amount: string;
          currency: string;
          status: string;
          receiptNo: string;
          method: string;
          packageName: string;
          note: string;
        } => Boolean(v)
      );
  }, [gym, currentPlanName, planNameById]);
  const totalPaidAmount = useMemo(() => {
    const parseAmount = (value: string): number => {
      const n = Number(String(value).replace(/[^0-9.-]/g, ''));
      return Number.isFinite(n) ? n : 0;
    };
    return billingHistoryRows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
  }, [billingHistoryRows]);

  const saveProfile = async () => {
    const body: Record<string, unknown> = {};
    if (profileDraft.name) body.name = profileDraft.name;
    if (profileDraft.slug) body.slug = profileDraft.slug;
    if (profileDraft.logoUrl) body.logoUrl = profileDraft.logoUrl;
    if (profileDraft.address) body.address = profileDraft.address;
    if (profileDraft.city) body.city = profileDraft.city;
    if (profileDraft.country) body.country = profileDraft.country;
    if (profileDraft.phone) body.phone = profileDraft.phone;
    if (profileDraft.email) body.email = profileDraft.email;
    const parsed = patchGymProfileSchema.safeParse(body);
    if (!parsed.success) {
      showAlert('error', 'Validation', parsed.error.errors.map((x) => x.message).join(', '));
      return;
    }
    try {
      await patchPlatformGym(id, parsed.data);
      showAlert('success', 'Saved', 'Gym profile updated.');
      load();
    } catch (e) {
      showAlert('error', 'Update failed', mapPlatformErrorToUserMessage(e));
    }
  };

  const saveSubscription = async () => {
    const body: Record<string, unknown> = {};
    if (subDraft.planId) body.planId = Number(subDraft.planId);
    if (subDraft.dueDate) body.dueDate = subDraft.dueDate;
    if (subDraft.markPaidAt) body.markPaidAt = subDraft.markPaidAt;
    if (subDraft.notes) body.notes = subDraft.notes;
    const parsed = patchSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      showAlert('error', 'Validation', parsed.error.errors.map((x) => x.message).join(', '));
      return;
    }
    try {
      await patchPlatformGymSubscription(id, parsed.data);
      showAlert('success', 'Saved', 'Subscription updated.');
      load();
    } catch (e) {
      showAlert('error', 'Update failed', mapPlatformErrorToUserMessage(e));
    }
  };

  const printReceipt = () => {
    if (!lastReceipt) {
      showAlert('error', 'No receipt', 'Please record a payment first to print receipt.');
      return;
    }
    if (typeof window === 'undefined') return;
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) {
      showAlert('error', 'Popup blocked', 'Please allow popups to print the receipt.');
      return;
    }
    const html = `
      <html>
        <head>
          <title>Receipt ${lastReceipt.receiptNo}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { margin: 0 0 4px; }
            .muted { color: #6b7280; margin-bottom: 20px; }
            .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-top: 12px; }
            .row { display: flex; justify-content: space-between; margin: 8px 0; }
            .label { color: #6b7280; }
            .amount { font-size: 24px; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>FitNix Gym Payment Receipt</h1>
          <div class="muted">Receipt #${lastReceipt.receiptNo}</div>
          <div class="card">
            <div class="row"><span class="label">Gym</span><span>${lastReceipt.gymName}</span></div>
            <div class="row"><span class="label">Package</span><span>${lastReceipt.packageName || '—'}</span></div>
            <div class="row"><span class="label">Paid date</span><span>${lastReceipt.paidAt}</span></div>
            <div class="row"><span class="label">Method</span><span>${lastReceipt.method}</span></div>
            <div class="row"><span class="label">Currency</span><span>${lastReceipt.currency}</span></div>
            <div class="row"><span class="label">Amount</span><span class="amount">${lastReceipt.currency} ${lastReceipt.amount}</span></div>
            <div class="row"><span class="label">Notes</span><span>${lastReceipt.notes || '—'}</span></div>
          </div>
          <p class="muted">Generated on ${new Date().toISOString().slice(0, 19).replace('T', ' ')}</p>
          <script>
            window.onload = function () { window.print(); };
          </script>
        </body>
      </html>
    `;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const printHistoryReceipt = (row: {
    receiptNo: string;
    date: string;
    amount: string;
    currency: string;
    method: string;
    packageName: string;
    note: string;
  }) => {
    setLastReceipt({
      receiptNo: row.receiptNo !== '—' ? row.receiptNo : `RCP-${Date.now()}`,
      gymName: String(gym?.name ?? 'Gym'),
      packageName: row.packageName || '—',
      amount: row.amount,
      currency: row.currency,
      paidAt: row.date,
      method: row.method,
      notes: row.note === '—' ? '' : row.note,
    });
    setTimeout(() => {
      printReceipt();
    }, 0);
  };

  const submitPayment = async () => {
    const amount = Number(paymentDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showAlert('error', 'Amount required', 'Please enter a valid payment amount greater than zero.');
      return;
    }
    if (!paymentDraft.paidAt) {
      showAlert('error', 'Payment date required', 'Please select a paid date.');
      return;
    }
    setSavingPayment(true);
    try {
      const payload = {
        amountPaid: amount,
        currency: paymentDraft.currency,
        paidAt: paymentDraft.paidAt,
        method: paymentDraft.method,
        notes: paymentDraft.notes.trim() || undefined,
      };
      const payment = (await recordPlatformGymPayment(id, payload)) as Record<string, unknown>;
      const receiptNo = String(payment.receiptNo ?? payment.receiptNumber ?? `RCPT-${Date.now()}`);
      const paidAt = String(payment.paidAt ?? payment.date ?? paymentDraft.paidAt).slice(0, 10);
      const currency = String(payment.currency ?? paymentDraft.currency);
      const amountPaid = Number(payment.amountPaid ?? payment.amount ?? amount);
      setLastReceipt({
        receiptNo,
        gymName: String(gym?.name ?? 'Gym'),
        packageName: String(
          payment.planName ??
            payment.packageName ??
            payment.subscriptionPlanName ??
            (payment.plan as Record<string, unknown> | undefined)?.name ??
            (payment.package as Record<string, unknown> | undefined)?.name ??
            currentPlanName
        ),
        amount: amountPaid.toFixed(2),
        currency,
        paidAt,
        method: String(payment.method ?? paymentDraft.method),
        notes: String(payment.notes ?? paymentDraft.notes).trim(),
      });
      showAlert('success', 'Payment recorded', 'Gym bill payment has been recorded successfully.');
      setPaymentDraft({
        amount: '',
        currency: paymentDraft.currency,
        paidAt: '',
        method: paymentDraft.method,
        notes: '',
      });
      load();
    } catch (e) {
      showAlert('error', 'Payment failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setSavingPayment(false);
    }
  };

  const runSuspendActivate = async () => {
    if (!confirm) return;
    const action = confirm;
    try {
      if (action === 'suspend') await suspendPlatformGym(id);
      else await activatePlatformGym(id);
      setConfirm(null);
      showAlert('success', 'Updated', action === 'suspend' ? 'Gym suspended.' : 'Gym activated.');
      load();
    } catch (e) {
      showAlert('error', 'Action failed', mapPlatformErrorToUserMessage(e));
    }
  };

  if (loading && !gym) {
    return <Loading message="Loading gym…" fullScreen size="md" />;
  }

  if (!gym) {
    return (
      <p className="text-dark-gray-light">
        <Link href="/platform/gyms" className="text-primary">
          ← Back to gyms
        </Link>
      </p>
    );
  }

  return (
    <>
      <Alert
        isOpen={alert.isOpen}
        onClose={closeAlert}
        type={alert.type}
        title={alert.title}
        message={alert.message}
      />
      <ConfirmationDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={runSuspendActivate}
        title={confirm === 'suspend' ? 'Suspend gym?' : 'Activate gym?'}
        message={
          confirm === 'suspend'
            ? 'While paused, this gym’s staff cannot sign in or use the gym apps until you turn access back on.'
            : 'Turn access back on so this gym’s staff can use the gym apps again.'
        }
        confirmText={confirm === 'suspend' ? 'Suspend' : 'Activate'}
        type={confirm === 'suspend' ? 'danger' : 'info'}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/platform/gyms" className="text-sm text-primary hover:underline">
            ← Gyms
          </Link>
          <h1 className="mt-1 text-2xl font-bold flex flex-wrap items-center gap-2">
            {String(gym.name ?? 'Gym')}
            {suspended ? (
              <span className="rounded-full bg-error-light px-2 py-0.5 text-xs text-error-dark">
                Paused
              </span>
            ) : (
              <span className="rounded-full bg-success-light px-2 py-0.5 text-xs text-success-dark">
                Active
              </span>
            )}
          </h1>
          <p className="text-sm text-dark-gray-light mt-1">
            {suspended
              ? 'This gym is paused — their team cannot use the gym portal until you activate it again.'
              : 'View profile, billing, and history for this gym.'}
          </p>
        </div>
        {isSuper && (
          <div className="flex gap-2">
            {suspended ? (
              <button
                type="button"
                onClick={() => setConfirm('activate')}
                className="rounded-lg bg-success px-4 py-2 text-sm text-white"
              >
                Activate
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirm('suspend')}
                className="rounded-lg bg-error px-4 py-2 text-sm text-white"
              >
                Suspend
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 border-b border-light-gray-dark flex gap-4 text-sm">
        {(['overview', 'subscription', 'activity'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`pb-2 capitalize border-b-2 -mb-px ${
              tab === t ? 'border-purple text-purple font-medium' : 'border-transparent text-dark-gray-light'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl bg-white p-4 shadow border border-light-gray-dark">
              <h2 className="font-semibold">Gym details</h2>
              <p className="text-xs text-dark-gray-light mt-1">Key facts from the tenant record.</p>
              <dl className="mt-4 space-y-2 text-sm">
                {gymProfileSummary(gym).map((row) => (
                  <div key={row.label} className="flex justify-between gap-4 border-b border-light-gray/80 pb-2">
                    <dt className="text-dark-gray-light shrink-0">{row.label}</dt>
                    <dd className="text-right font-medium text-dark-gray break-words">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <details className="mt-4 text-xs">
                <summary className="cursor-pointer text-primary font-medium">Technical details (raw)</summary>
                <pre className="mt-2 overflow-auto max-h-64 bg-light-gray p-3 rounded-lg text-[11px] leading-relaxed">
                  {JSON.stringify(gym, null, 2)}
                </pre>
              </details>
            </section>
            <section className="rounded-xl bg-white p-4 shadow border border-light-gray-dark">
              <h2 className="font-semibold">Edit profile</h2>
              {!isSuper && (
                <p className="mt-2 text-sm text-dark-gray-light">
                  You can view this gym. Only a super admin can change profile details.
                </p>
              )}
              <div className={`mt-4 space-y-3 text-sm ${!isSuper ? 'opacity-50 pointer-events-none' : ''}`}>
                <PlatformLogoUpload
                  value={profileDraft.logoUrl}
                  onChange={(url) => setProfileDraft((d) => ({ ...d, logoUrl: url }))}
                  disabled={!isSuper}
                  showUrlFallback
                />
                <div>
                  <label className="text-xs text-dark-gray-light">Country</label>
                  <select
                    value={profileDraft.country}
                    onChange={(e) =>
                      setProfileDraft((d) => {
                        const nextCountry = e.target.value;
                        const nextCities = getCitiesForCountry(nextCountry, locationCatalog);
                        const nextCity = nextCities.includes(d.city) ? d.city : '';
                        return { ...d, country: nextCountry, city: nextCity };
                      })
                    }
                    className="w-full rounded border px-2 py-1.5 bg-white"
                  >
                    <option value="" disabled>
                      Select country
                    </option>
                    {countryOptions.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-dark-gray-light">City</label>
                  <select
                    value={profileDraft.city}
                    onChange={(e) => setProfileDraft((d) => ({ ...d, city: e.target.value }))}
                    className="w-full rounded border px-2 py-1.5 bg-white"
                    disabled={!profileDraft.country}
                  >
                    <option value="" disabled>
                      {profileDraft.country ? 'Select city' : 'Select country first'}
                    </option>
                    {cityOptions.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </div>
                {PROFILE_FIELDS.map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-xs text-dark-gray-light">{label}</label>
                    <input
                      value={profileDraft[key]}
                      onChange={(e) => setProfileDraft((d) => ({ ...d, [key]: e.target.value }))}
                      className="w-full rounded border px-2 py-1.5"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={!isSuper}
                  className="rounded-lg bg-primary px-4 py-2 text-white text-sm disabled:opacity-40"
                >
                  Save changes
                </button>
              </div>
            </section>
          </div>
        )}

        {tab === 'subscription' && (
          <section className="rounded-xl bg-white p-4 shadow border border-light-gray-dark max-w-lg">
            <h2 className="font-semibold">Subscription / billing</h2>
            {!isSuper && (
              <p className="mt-2 text-sm text-dark-gray-light">
                You can view billing here. Only a super admin can change plan or payment fields.
              </p>
            )}
            <div className={`mt-4 space-y-3 text-sm ${!isSuper ? 'opacity-50 pointer-events-none' : ''}`}>
              <div>
                <label className="text-xs text-dark-gray-light">Billing plan ID</label>
                <select
                  value={subDraft.planId}
                  onChange={(e) => setSubDraft((d) => ({ ...d, planId: e.target.value }))}
                  className="w-full rounded border px-2 py-1.5 bg-white"
                  disabled={plansLoading || plans.length === 0}
                >
                  <option value="" disabled>
                    {plansLoading ? 'Loading plans…' : plans.length === 0 ? 'No active plan available' : 'Select billing plan'}
                  </option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-dark-gray-light">Next payment date</label>
                <input
                  type="date"
                  value={subDraft.dueDate}
                  onChange={(e) => setSubDraft((d) => ({ ...d, dueDate: e.target.value }))}
                  className="w-full rounded border px-2 py-1.5"
                />
              </div>
              <div>
                <label className="text-xs text-dark-gray-light">Marked paid on</label>
                <input
                  type="date"
                  value={subDraft.markPaidAt}
                  onChange={(e) => setSubDraft((d) => ({ ...d, markPaidAt: e.target.value }))}
                  className="w-full rounded border px-2 py-1.5"
                />
              </div>
              <div>
                <label className="text-xs text-dark-gray-light">Internal notes</label>
                <textarea
                  value={subDraft.notes}
                  onChange={(e) => setSubDraft((d) => ({ ...d, notes: e.target.value }))}
                  className="w-full rounded border px-2 py-1.5 min-h-[80px]"
                />
              </div>
              <button
                type="button"
                onClick={saveSubscription}
                disabled={!isSuper}
                className="rounded-lg bg-purple px-4 py-2 text-white text-sm disabled:opacity-40"
              >
                Update subscription
              </button>
            </div>
          </section>
        )}

        {tab === 'activity' && (
          <section className="rounded-xl bg-white p-4 shadow border border-light-gray-dark">
            <h2 className="font-semibold">History</h2>
            {isSuper ? (
              <p className="mt-2 text-sm">
                <Link
                  href={`/platform/audit?targetGymId=${encodeURIComponent(id)}`}
                  className="text-primary font-medium hover:underline"
                >
                  View audit trail for this gym →
                </Link>
              </p>
            ) : (
              <p className="mt-2 text-sm text-dark-gray-light">
                The full audit trail is limited to super admins. Ask a super admin if you need a copy of events.
              </p>
            )}
            <p className="mt-4 text-xs text-dark-gray-light max-w-xl">
              To add more gym managers or reset an owner password after setup, use your support process until those
              tools exist in the product.
            </p>
            <div className="mt-6">
              <h3 className="font-medium text-sm">Billing history</h3>
              <p className="mt-1 text-xs text-dark-gray-light">Total paid: {totalPaidAmount.toLocaleString()}</p>
              {billingHistoryRows.length === 0 ? (
                <p className="mt-2 text-sm text-dark-gray-light">
                  No billing history records found for this gym yet.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-lg border border-light-gray-dark">
                  <table className="min-w-full text-sm">
                    <thead className="bg-light-gray text-left text-dark-gray-light">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Receipt</th>
                        <th className="px-3 py-2">Package</th>
                        <th className="px-3 py-2">Method</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Notes</th>
                        <th className="px-3 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingHistoryRows.map((row) => (
                        <tr key={row.key} className="border-t">
                          <td className="px-3 py-2">{row.date}</td>
                          <td className="px-3 py-2">
                            {row.currency} {row.amount}
                          </td>
                          <td className="px-3 py-2">{row.receiptNo}</td>
                          <td className="px-3 py-2">{row.packageName}</td>
                          <td className="px-3 py-2">{row.method}</td>
                          <td className="px-3 py-2">{row.status}</td>
                          <td className="px-3 py-2">{row.note}</td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => printHistoryReceipt(row)}
                              className="rounded border px-2 py-1 text-xs"
                            >
                              Print receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}
        {tab === 'subscription' && (
          <section className="rounded-xl bg-white p-4 shadow border border-light-gray-dark max-w-lg mt-6">
            <h2 className="font-semibold">Pay gym bill</h2>
            <p className="mt-1 text-xs text-dark-gray-light">
              Record payment and print a receipt for the gym owner.
            </p>
            <p className="mt-1 text-xs text-dark-gray-light">
              Package:{' '}
              <span className="font-medium text-dark-gray">
                {currentPlanName}
              </span>
            </p>
            <div className={`mt-4 space-y-3 text-sm ${!isSuper ? 'opacity-50 pointer-events-none' : ''}`}>
              <div>
                <label className="text-xs text-dark-gray-light">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentDraft.amount}
                  onChange={(e) => setPaymentDraft((d) => ({ ...d, amount: e.target.value }))}
                  className="w-full rounded border px-2 py-1.5"
                  placeholder="2500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-dark-gray-light">Currency</label>
                  <input
                    value={paymentDraft.currency}
                    onChange={(e) => setPaymentDraft((d) => ({ ...d, currency: e.target.value.toUpperCase() }))}
                    className="w-full rounded border px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="text-xs text-dark-gray-light">Paid date</label>
                  <input
                    type="date"
                    value={paymentDraft.paidAt}
                    onChange={(e) => setPaymentDraft((d) => ({ ...d, paidAt: e.target.value }))}
                    className="w-full rounded border px-2 py-1.5"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-dark-gray-light">Payment method</label>
                <select
                  value={paymentDraft.method}
                  onChange={(e) => setPaymentDraft((d) => ({ ...d, method: e.target.value }))}
                  className="w-full rounded border px-2 py-1.5 bg-white"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CARD">Card</option>
                  <option value="JAZZCASH">JazzCash</option>
                  <option value="EASYPAISA">EasyPaisa</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-dark-gray-light">Notes</label>
                <textarea
                  value={paymentDraft.notes}
                  onChange={(e) => setPaymentDraft((d) => ({ ...d, notes: e.target.value }))}
                  className="w-full rounded border px-2 py-1.5 min-h-[80px]"
                  placeholder="Optional payment reference"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={submitPayment}
                  disabled={!isSuper || savingPayment}
                  className="rounded-lg bg-success px-4 py-2 text-white text-sm disabled:opacity-40"
                >
                  {savingPayment ? 'Saving…' : 'Pay bill / record payment'}
                </button>
                <button
                  type="button"
                  onClick={printReceipt}
                  disabled={!lastReceipt}
                  className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
                >
                  Print last receipt
                </button>
              </div>
              {lastReceipt && (
                <p className="text-xs text-dark-gray-light">
                  Last receipt: {lastReceipt.receiptNo} · {lastReceipt.packageName} · {lastReceipt.currency}{' '}
                  {lastReceipt.amount} · {lastReceipt.paidAt}
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

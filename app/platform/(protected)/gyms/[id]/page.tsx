'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  activatePlatformGym,
  getPlatformGym,
  patchPlatformGym,
  patchPlatformGymSubscription,
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

type Tab = 'overview' | 'subscription' | 'activity';

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Profile',
  subscription: 'Billing',
  activity: 'History',
};

const PROFILE_FIELDS: { key: 'name' | 'slug' | 'address' | 'city' | 'country' | 'phone' | 'email'; label: string }[] = [
  { key: 'name', label: 'Gym name' },
  { key: 'slug', label: 'Web address key' },
  { key: 'address', label: 'Street address' },
  { key: 'city', label: 'City' },
  { key: 'country', label: 'Country' },
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
        country: String(data.country ?? ''),
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

  const tenantStatus = String(gym?.tenantStatus ?? gym?.status ?? '').toUpperCase();
  const suspended = tenantStatus === 'SUSPENDED';

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
                <input
                  value={subDraft.planId}
                  onChange={(e) => setSubDraft((d) => ({ ...d, planId: e.target.value.replace(/\D/g, '') }))}
                  className="w-full rounded border px-2 py-1.5"
                />
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
          </section>
        )}
      </div>
    </>
  );
}

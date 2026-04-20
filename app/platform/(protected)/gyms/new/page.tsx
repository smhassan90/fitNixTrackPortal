'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, addDays } from 'date-fns';
import { createPlatformGym } from '@/lib/platform/platformApi';
import { createGymBodySchema } from '@/lib/platform/validation';
import { suggestSlugFromName } from '@/lib/platform/slug';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import { useIsPlatformSuperAdmin } from '@/contexts/PlatformAuthContext';
import GeneratedPasswordModal from '@/components/platform/GeneratedPasswordModal';
import PlatformLogoUpload from '@/components/platform/PlatformLogoUpload';
import Alert from '@/components/Alert';
import { useAlert } from '@/hooks/useAlert';
import Loading from '@/components/Loading';

const STEPS = ['Name', 'Slug', 'Location', 'Logo', 'Plan & dates', 'Owner', 'Review'] as const;

type Wizard = {
  name: string;
  slug: string;
  address: string;
  city: string;
  country: string;
  logoUrl: string;
  planId: string;
  dueDate: string;
  isActive: boolean;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerPassword: string;
};

const initialWizard = (): Wizard => ({
  name: '',
  slug: '',
  address: '',
  city: '',
  country: '',
  logoUrl: '',
  planId: '1',
  dueDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
  isActive: true,
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  ownerPassword: '',
});

export default function CreateGymWizardPage() {
  const router = useRouter();
  const isSuper = useIsPlatformSuperAdmin();
  const { alert, showAlert, closeAlert } = useAlert();
  const [step, setStep] = useState(0);
  const [w, setW] = useState<Wizard>(initialWizard);
  const [submitting, setSubmitting] = useState(false);
  const [genPw, setGenPw] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);

  useEffect(() => {
    if (!isSuper) {
      router.replace('/platform/gyms');
    }
  }, [isSuper, router]);

  const canNext = useMemo(() => {
    switch (step) {
      case 0:
        return w.name.trim().length > 0;
      case 1:
        return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(w.slug.trim());
      case 2:
        return true;
      case 3:
        if (logoBusy) return false;
        if (!w.logoUrl.trim()) return true;
        try {
          const u = new URL(w.logoUrl.trim());
          return u.protocol === 'http:' || u.protocol === 'https:';
        } catch {
          return false;
        }
      case 4:
        return /^\d+$/.test(w.planId) && Number(w.planId) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(w.dueDate);
      case 5:
        return w.ownerName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(w.ownerEmail.trim());
      default:
        return true;
    }
  }, [step, w, logoBusy]);

  const goNext = () => {
    if (step === 0 && !w.slug.trim()) {
      setW((prev) => ({ ...prev, slug: suggestSlugFromName(prev.name) }));
    }
    if (canNext && step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const submit = async () => {
    const body = {
      name: w.name.trim(),
      slug: w.slug.trim(),
      logoUrl: w.logoUrl.trim() || undefined,
      address: w.address.trim() || undefined,
      city: w.city.trim() || undefined,
      country: w.country.trim() || undefined,
      ownerAdmin: {
        name: w.ownerName.trim(),
        email: w.ownerEmail.trim(),
        phone: w.ownerPhone.trim() || undefined,
        password: w.ownerPassword.trim() || undefined,
      },
      planId: Number(w.planId),
      dueDate: w.dueDate,
      isActive: w.isActive,
    };

    const parsed = createGymBodySchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => e.message).join(' ');
      showAlert('error', 'Validation', msg);
      return;
    }

    const payload: Record<string, unknown> = {
      name: parsed.data.name,
      slug: parsed.data.slug,
      planId: parsed.data.planId,
      dueDate: parsed.data.dueDate,
      isActive: parsed.data.isActive,
      ownerAdmin: {
        name: parsed.data.ownerAdmin.name,
        email: parsed.data.ownerAdmin.email,
      },
    };
    if (parsed.data.logoUrl) payload.logoUrl = parsed.data.logoUrl;
    if (parsed.data.address) payload.address = parsed.data.address;
    if (parsed.data.city) payload.city = parsed.data.city;
    if (parsed.data.country) payload.country = parsed.data.country;
    if (parsed.data.ownerAdmin.phone) {
      (payload.ownerAdmin as Record<string, string>).phone = parsed.data.ownerAdmin.phone;
    }
    if (parsed.data.ownerAdmin.password) {
      (payload.ownerAdmin as Record<string, string>).password = parsed.data.ownerAdmin.password;
    }

    setSubmitting(true);
    try {
      const data = (await createPlatformGym(payload)) as { generatedPassword?: string; gym?: { id?: string | number } };
      if (data.generatedPassword) {
        setGenPw(data.generatedPassword);
      } else {
        showAlert('success', 'Gym created', 'The gym was created successfully.');
      }
      const id = data.gym && typeof data.gym === 'object' && data.gym !== null && 'id' in data.gym ? data.gym.id : null;
      if (!data.generatedPassword && id != null) {
        router.push(`/platform/gyms/${id}`);
      }
    } catch (e) {
      showAlert('error', 'Create failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isSuper) {
    return <Loading message="Redirecting…" fullScreen size="sm" />;
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
      <GeneratedPasswordModal
        open={!!genPw}
        password={genPw || ''}
        onClose={() => {
          setGenPw(null);
          router.push('/platform/gyms');
        }}
      />

      <div className="max-w-2xl">
        <Link href="/platform/gyms" className="text-sm text-primary hover:underline">
          ← Gyms
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-dark-gray">Create gym</h1>
        <p className="text-sm text-dark-gray-light mt-1">
          Add a new tenant step by step. You will need the billing <strong>plan ID</strong> from your finance team if
          you do not have a plan picker yet.
        </p>

        <div className="mt-4 flex gap-1 flex-wrap">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={`rounded-full px-2 py-1 text-xs ${
                i === step ? 'bg-purple text-white' : i < step ? 'bg-primary/20 text-dark-gray' : 'bg-light-gray-dark/40'
              }`}
            >
              {i + 1}. {label}
            </span>
          ))}
        </div>

        <div className="mt-6 rounded-xl bg-white p-6 shadow border border-light-gray-dark space-y-4">
          {step === 0 && (
            <>
              <label className="block text-sm font-medium">Gym name</label>
              <input
                value={w.name}
                onChange={(e) => setW((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="FitNix Karachi"
              />
            </>
          )}
          {step === 1 && (
            <>
              <label className="block text-sm font-medium">Web address key</label>
              <p className="text-xs text-dark-gray-light">
                Short code used in links (lowercase letters, numbers, and hyphens only).
              </p>
              <input
                value={w.slug}
                onChange={(e) =>
                  setW((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="fitnix-karachi"
              />
              <button
                type="button"
                className="text-sm text-primary"
                onClick={() => setW((p) => ({ ...p, slug: suggestSlugFromName(p.name) }))}
              >
                Suggest from name
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <label className="block text-sm font-medium">Address</label>
              <input
                value={w.address}
                onChange={(e) => setW((p) => ({ ...p, address: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <label className="block text-sm font-medium">City</label>
              <input
                value={w.city}
                onChange={(e) => setW((p) => ({ ...p, city: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <label className="block text-sm font-medium">Country</label>
              <input
                value={w.country}
                onChange={(e) => setW((p) => ({ ...p, country: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </>
          )}
          {step === 3 && (
            <PlatformLogoUpload
              value={w.logoUrl}
              onChange={(url) => setW((p) => ({ ...p, logoUrl: url }))}
              onBusyChange={setLogoBusy}
              showUrlFallback
            />
          )}
          {step === 4 && (
            <>
              <label className="block text-sm font-medium">Billing plan ID</label>
              <input
                value={w.planId}
                onChange={(e) => setW((p) => ({ ...p, planId: e.target.value.replace(/\D/g, '') }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <label className="block text-sm font-medium">Next payment date</label>
              <input
                type="date"
                value={w.dueDate}
                onChange={(e) => setW((p) => ({ ...p, dueDate: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={w.isActive}
                  onChange={(e) => setW((p) => ({ ...p, isActive: e.target.checked }))}
                />
                Start as active (uncheck to create the gym paused)
              </label>
            </>
          )}
          {step === 5 && (
            <>
              <p className="text-xs text-dark-gray-light">
                This person becomes the first gym admin. Leave the password blank to let the system create one — you
                will be asked to copy it once.
              </p>
              <label className="block text-sm font-medium">Owner name</label>
              <input
                value={w.ownerName}
                onChange={(e) => setW((p) => ({ ...p, ownerName: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <label className="block text-sm font-medium">Owner email</label>
              <input
                type="email"
                value={w.ownerEmail}
                onChange={(e) => setW((p) => ({ ...p, ownerEmail: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <label className="block text-sm font-medium">Phone (optional)</label>
              <input
                value={w.ownerPhone}
                onChange={(e) => setW((p) => ({ ...p, ownerPhone: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <label className="block text-sm font-medium">Password (optional, min 8 if set)</label>
              <input
                type="password"
                autoComplete="new-password"
                value={w.ownerPassword}
                onChange={(e) => setW((p) => ({ ...p, ownerPassword: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </>
          )}
          {step === 6 && (
            <dl className="text-sm space-y-2">
              <div className="flex justify-between gap-4">
                <dt className="text-dark-gray-light">Name</dt>
                <dd>{w.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-dark-gray-light">Web address key</dt>
                <dd>{w.slug}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-dark-gray-light">Location</dt>
                <dd className="text-right">
                  {[w.address, w.city, w.country].filter(Boolean).join(', ') || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-4 items-start">
                <dt className="text-dark-gray-light shrink-0">Logo</dt>
                <dd className="text-right min-w-0 max-w-[70%]">
                  {w.logoUrl ? (
                    <span className="inline-flex flex-col items-end gap-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={w.logoUrl} alt="" className="h-12 w-12 object-contain border rounded bg-white" />
                      <span className="text-xs text-dark-gray-light break-all">{w.logoUrl}</span>
                    </span>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-dark-gray-light">Billing</dt>
                <dd>
                  Plan #{w.planId} · next payment {w.dueDate} ({w.isActive ? 'starts active' : 'starts paused'})
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-dark-gray-light">Owner</dt>
                <dd className="text-right">{`${w.ownerName} <${w.ownerEmail}>`}</dd>
              </div>
            </dl>
          )}

          <div className="flex justify-between pt-4 border-t">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0}
              className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
            >
              Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!canNext}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-40"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="rounded-lg bg-purple px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {submitting ? 'Creating…' : 'Create gym'}
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-xs text-dark-gray-light max-w-xl">
          Need to add more managers later or reset the owner password? Use your internal support process until those
          self-service tools ship.
        </p>
      </div>
    </>
  );
}

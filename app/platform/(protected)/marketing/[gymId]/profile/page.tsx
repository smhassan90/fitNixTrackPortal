'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getMarketingProfile, updateMarketingProfile } from '@/lib/platform/marketingApi';
import type { MarketingProfile } from '@/lib/platform/marketingTypes';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import MarketingSubNav from '@/components/platform/marketing/MarketingSubNav';
import Loading from '@/components/Loading';
import Alert from '@/components/Alert';
import { useAlert } from '@/hooks/useAlert';

type ProfileDraft = {
  description: string;
  location: string;
  city: string;
  country: string;
  address: string;
  phone: string;
  website: string;
  services: string;
  membershipPackages: string;
  targetAudience: string;
  uniqueSellingPoints: string;
  facilities: string;
  trainers: string;
  promotions: string;
  brandTone: string;
  preferredLanguage: string;
  keywords: string;
  seoTopics: string;
  doNotClaim: string;
  additionalInstructions: string;
};

const EMPTY: ProfileDraft = {
  description: '',
  location: '',
  city: '',
  country: '',
  address: '',
  phone: '',
  website: '',
  services: '',
  membershipPackages: '',
  targetAudience: '',
  uniqueSellingPoints: '',
  facilities: '',
  trainers: '',
  promotions: '',
  brandTone: '',
  preferredLanguage: '',
  keywords: '',
  seoTopics: '',
  doNotClaim: '',
  additionalInstructions: '',
};

function fromApi(p: MarketingProfile): ProfileDraft {
  return {
    description: p.description ?? '',
    location: p.location ?? '',
    city: p.city ?? '',
    country: p.country ?? '',
    address: p.address ?? '',
    phone: p.phone ?? '',
    website: p.website ?? '',
    services: p.services ?? '',
    membershipPackages: p.membershipPackages ?? '',
    targetAudience: p.targetAudience ?? '',
    uniqueSellingPoints: p.uniqueSellingPoints ?? '',
    facilities: p.facilities ?? '',
    trainers: p.trainers ?? '',
    promotions: p.promotions ?? '',
    brandTone: p.brandTone ?? '',
    preferredLanguage: p.preferredLanguage ?? '',
    keywords: p.keywords ?? '',
    seoTopics: p.seoTopics ?? '',
    doNotClaim: p.doNotClaim ?? '',
    additionalInstructions: p.additionalInstructions ?? '',
  };
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-dark-gray">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-dark-gray-light">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-light-gray-dark bg-white px-3 py-2 text-sm outline-none focus:border-primary';
const areaClass = `${inputClass} min-h-[88px] resize-y`;

export default function MarketingProfilePage() {
  const params = useParams();
  const gymId = String(params.gymId);
  const { alert, showAlert, closeAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gymName, setGymName] = useState<string | undefined>();
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY);

  const setField = useCallback(<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const profile = await getMarketingProfile(gymId);
        if (cancelled) return;
        setGymName(profile.gymName);
        setDraft(fromApi(profile));
      } catch (e) {
        if (!cancelled) {
          showAlert('error', 'Marketing profile', mapPlatformErrorToUserMessage(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gymId, showAlert]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await updateMarketingProfile(gymId, {
        description: draft.description || null,
        location: draft.location || null,
        city: draft.city || null,
        country: draft.country || null,
        address: draft.address || null,
        phone: draft.phone || null,
        website: draft.website || null,
        services: draft.services || null,
        membershipPackages: draft.membershipPackages || null,
        targetAudience: draft.targetAudience || null,
        uniqueSellingPoints: draft.uniqueSellingPoints || null,
        facilities: draft.facilities || null,
        trainers: draft.trainers || null,
        promotions: draft.promotions || null,
        brandTone: draft.brandTone || null,
        preferredLanguage: draft.preferredLanguage || null,
        keywords: draft.keywords || null,
        seoTopics: draft.seoTopics || null,
        doNotClaim: draft.doNotClaim || null,
        additionalInstructions: draft.additionalInstructions || null,
      });
      setGymName(saved.gymName);
      setDraft(fromApi(saved));
      showAlert('success', 'Saved', 'Marketing profile updated. AI will use only these facts.');
    } catch (err) {
      showAlert('error', 'Save failed', mapPlatformErrorToUserMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Loading message="Loading marketing profile…" fullScreen size="md" />;
  }

  return (
    <div>
      <MarketingSubNav gymId={gymId} gymName={gymName} />

      <Alert
        isOpen={alert.isOpen}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={closeAlert}
      />

      <p className="mb-6 max-w-3xl text-sm text-dark-gray-light">
        This profile is the source of truth for AI recommendations. Leave fields empty when you do
        not know the fact — never invent reviews, ratings, awards, pricing, or statistics.
      </p>

      <form onSubmit={handleSave} className="space-y-8">
        <section className="rounded-xl border border-light-gray-dark bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-dark-gray">Basics</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Description" hint="What this gym is, in plain language.">
              <textarea
                className={areaClass}
                value={draft.description}
                onChange={(e) => setField('description', e.target.value)}
              />
            </Field>
            <Field label="Website">
              <input
                className={inputClass}
                type="url"
                placeholder="https://"
                value={draft.website}
                onChange={(e) => setField('website', e.target.value)}
              />
            </Field>
            <Field label="Phone">
              <input
                className={inputClass}
                value={draft.phone}
                onChange={(e) => setField('phone', e.target.value)}
              />
            </Field>
            <Field label="Preferred language">
              <input
                className={inputClass}
                placeholder="e.g. English, Urdu"
                value={draft.preferredLanguage}
                onChange={(e) => setField('preferredLanguage', e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-light-gray-dark bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-dark-gray">Location</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Address">
              <input
                className={inputClass}
                value={draft.address}
                onChange={(e) => setField('address', e.target.value)}
              />
            </Field>
            <Field label="Location label" hint="Neighborhood or area nickname if useful.">
              <input
                className={inputClass}
                value={draft.location}
                onChange={(e) => setField('location', e.target.value)}
              />
            </Field>
            <Field label="City">
              <input
                className={inputClass}
                value={draft.city}
                onChange={(e) => setField('city', e.target.value)}
              />
            </Field>
            <Field label="Country">
              <input
                className={inputClass}
                value={draft.country}
                onChange={(e) => setField('country', e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-light-gray-dark bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-dark-gray">Offer & audience</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Services" hint="One per line or comma-separated.">
              <textarea
                className={areaClass}
                value={draft.services}
                onChange={(e) => setField('services', e.target.value)}
              />
            </Field>
            <Field label="Membership packages" hint="Only real packages you will stand behind.">
              <textarea
                className={areaClass}
                value={draft.membershipPackages}
                onChange={(e) => setField('membershipPackages', e.target.value)}
              />
            </Field>
            <Field label="Facilities">
              <textarea
                className={areaClass}
                value={draft.facilities}
                onChange={(e) => setField('facilities', e.target.value)}
              />
            </Field>
            <Field label="Trainers" hint="Names/specialties only if confirmed.">
              <textarea
                className={areaClass}
                value={draft.trainers}
                onChange={(e) => setField('trainers', e.target.value)}
              />
            </Field>
            <Field label="Target audience">
              <textarea
                className={areaClass}
                value={draft.targetAudience}
                onChange={(e) => setField('targetAudience', e.target.value)}
              />
            </Field>
            <Field label="Unique selling points">
              <textarea
                className={areaClass}
                value={draft.uniqueSellingPoints}
                onChange={(e) => setField('uniqueSellingPoints', e.target.value)}
              />
            </Field>
            <Field label="Current promotions">
              <textarea
                className={areaClass}
                value={draft.promotions}
                onChange={(e) => setField('promotions', e.target.value)}
              />
            </Field>
            <Field label="Brand tone">
              <input
                className={inputClass}
                placeholder="e.g. professional, friendly, premium"
                value={draft.brandTone}
                onChange={(e) => setField('brandTone', e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-light-gray-dark bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-dark-gray">SEO & AI guardrails</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Keywords" hint="Useful topics, not stuffing lists.">
              <textarea
                className={areaClass}
                value={draft.keywords}
                onChange={(e) => setField('keywords', e.target.value)}
              />
            </Field>
            <Field label="Important SEO topics">
              <textarea
                className={areaClass}
                value={draft.seoTopics}
                onChange={(e) => setField('seoTopics', e.target.value)}
              />
            </Field>
            <Field
              label="Things the AI must not claim"
              hint="Awards, member counts, results, certifications, pricing — list anything false or unknown."
            >
              <textarea
                className={areaClass}
                value={draft.doNotClaim}
                onChange={(e) => setField('doNotClaim', e.target.value)}
              />
            </Field>
            <Field label="Additional marketing instructions">
              <textarea
                className={areaClass}
                value={draft.additionalInstructions}
                onChange={(e) => setField('additionalInstructions', e.target.value)}
              />
            </Field>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary rounded-lg px-5 py-2.5 text-sm disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
          <p className="text-xs text-dark-gray-light">
            Changes apply to future AI generations only. Nothing auto-publishes.
          </p>
        </div>
      </form>
    </div>
  );
}

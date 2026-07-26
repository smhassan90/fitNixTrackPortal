'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Outfit } from 'next/font/google';

const brandFont = Outfit({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
});

const CONTACT_EMAIL = 'dev.fynals@gmail.com';
const EMAIL_MAX = 191;
const PHONE_MAX = 40;
const NAME_MAX = 100;

type AccountType = 'member' | 'trainer' | 'other';

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  accountType: AccountType;
  gymName: string;
  reason: string;
  confirm: boolean;
};

const emptyForm = (): FormState => ({
  fullName: '',
  email: '',
  phone: '',
  accountType: 'member',
  gymName: '',
  reason: '',
  confirm: false,
});

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function AccountDeletionPage() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [referenceId, setReferenceId] = useState<string | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const fullName = form.fullName.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();

    if (!fullName) {
      setError('Please enter your full name.');
      return;
    }
    if (!email && !phone) {
      setError('Provide at least an email or phone number so we can find your account.');
      return;
    }
    if (email && !isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!form.confirm) {
      setError('Please confirm that you want your account and associated data deleted.');
      return;
    }

    const payload = {
      fullName,
      email: email || null,
      phone: phone || null,
      accountType: form.accountType,
      gymName: form.gymName.trim() || null,
      reason: form.reason.trim() || null,
      source: 'web',
    };

    setSubmitting(true);
    try {
      const response = await fetch('/api/account-deletion-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || data?.success === false) {
        const message =
          data?.error?.message ||
          (typeof data?.message === 'string' ? data.message : null) ||
          'Could not submit your request. Please try again or email us.';
        throw new Error(message);
      }

      const id =
        data?.data?.id ??
        data?.data?.request?.id ??
        data?.data?.referenceId ??
        null;
      setReferenceId(id ? String(id) : null);
      setSubmitted(true);
      setForm(emptyForm());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      // If backend is not deployed yet, still offer mailto path
      if (/404|not found|failed to fetch|network/i.test(message)) {
        setError(
          `The deletion API is not available yet. Please email ${CONTACT_EMAIL} with your name, phone or email, and gym name to request deletion.`
        );
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f8f8] text-[#0f0f0f]">
      <header className="border-b border-black/10 bg-[#0f0f0f] text-white">
        <div className="mx-auto flex max-w-xl items-center justify-between px-5 py-5 sm:px-6">
          <div className={brandFont.className}>
            <p className="text-lg font-extrabold tracking-tight">
              Fit<span className="text-[#5DD62C]">Nix</span> Track
            </p>
            <p className="text-xs font-medium text-white/60">Account deletion request</p>
          </div>
          <Link
            href="/privacy"
            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium text-white/90 transition hover:bg-white/10"
          >
            Privacy Policy
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5 py-10 sm:px-6 sm:py-14">
        <div className={brandFont.className}>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#337418]">
            Your data
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Request account deletion
          </h1>
          <p className="mt-3 text-base leading-relaxed text-[#202020]/90">
            Use this form to ask FitNix Track to delete your mobile app account and associated
            personal data. This page works without installing the app (Google Play requirement).
          </p>
        </div>

        <div className="mt-6 space-y-3 rounded-2xl border border-black/10 bg-white p-5 text-sm leading-relaxed text-[#202020] shadow-sm">
          <p className="font-semibold text-[#0f0f0f]">What happens when you submit</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>We verify your identity using the contact details you provide.</li>
            <li>
              We delete or anonymize account login data and personal profile fields tied to the App
              (for example name, phone, email, photo) where we are the controller.
            </li>
            <li>
              Some gym business records (for example historical attendance or payments kept by your
              gym) may be retained or anonymized as required by law or legitimate gym operations.
            </li>
            <li>
              We aim to complete verified requests within <strong>30 days</strong>. You will receive
              a confirmation by email or SMS when possible.
            </li>
          </ul>
        </div>

        {submitted ? (
          <div className="mt-8 rounded-2xl border border-[#5DD62C]/40 bg-white p-6 shadow-sm">
            <h2 className={`${brandFont.className} text-xl font-bold text-[#0f0f0f]`}>
              Request received
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#202020]">
              Thank you. Your account deletion request has been submitted. We will process it after
              verifying your identity
              {referenceId ? (
                <>
                  . Reference ID: <span className="font-mono font-semibold">{referenceId}</span>
                </>
              ) : (
                '.'
              )}
            </p>
            <p className="mt-3 text-sm text-black/60">
              Questions? Email{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=Account%20deletion%20request`}
                className="font-medium text-[#337418] underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setReferenceId(null);
              }}
              className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-ink transition hover:bg-primary-dark hover:text-white"
            >
              Submit another request
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-4 rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-6"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0f0f0f]">Full name *</label>
              <input
                type="text"
                required
                maxLength={NAME_MAX}
                value={form.fullName}
                onChange={(e) => update('fullName', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-[#5DD62C]"
                placeholder="As shown in the FitNix Track app"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0f0f0f]">Email</label>
                <input
                  type="email"
                  maxLength={EMAIL_MAX}
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-[#5DD62C]"
                  placeholder="you@gmail.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0f0f0f]">Phone</label>
                <input
                  type="tel"
                  maxLength={PHONE_MAX}
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-[#5DD62C]"
                  placeholder="03001234567"
                />
              </div>
            </div>
            <p className="text-xs text-black/50">At least one of email or phone is required.</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0f0f0f]">Account type</label>
                <select
                  value={form.accountType}
                  onChange={(e) => update('accountType', e.target.value as AccountType)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-[#5DD62C]"
                >
                  <option value="member">Member</option>
                  <option value="trainer">Trainer</option>
                  <option value="other">Other / not sure</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0f0f0f]">Gym name</label>
                <input
                  type="text"
                  maxLength={200}
                  value={form.gymName}
                  onChange={(e) => update('gymName', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-[#5DD62C]"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#0f0f0f]">
                Additional details (optional)
              </label>
              <textarea
                rows={3}
                maxLength={1000}
                value={form.reason}
                onChange={(e) => update('reason', e.target.value)}
                className="w-full resize-y rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-[#5DD62C]"
                placeholder="Anything that helps us locate your account"
              />
            </div>

            <label className="flex items-start gap-3 text-sm text-[#202020]">
              <input
                type="checkbox"
                checked={form.confirm}
                onChange={(e) => update('confirm', e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-[#5DD62C] focus:ring-[#5DD62C]"
              />
              <span>
                I request permanent deletion of my FitNix Track account and associated personal data,
                and I understand some gym business records may be retained in anonymized or legally
                required form.
              </span>
            </label>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
                <p className="mt-2">
                  Or email{' '}
                  <a
                    href={`mailto:${CONTACT_EMAIL}?subject=Account%20deletion%20request`}
                    className="font-medium underline underline-offset-2"
                  >
                    {CONTACT_EMAIL}
                  </a>
                  .
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[#5DD62C] py-2.5 text-sm font-semibold text-[#0f0f0f] transition hover:bg-[#337418] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit deletion request'}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-sm text-black/50">
          Prefer email?{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Account%20deletion%20request`}
            className="font-medium text-[#337418] underline underline-offset-2"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </main>
    </div>
  );
}

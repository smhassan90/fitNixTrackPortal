'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePlatformAuth } from '@/contexts/PlatformAuthContext';
import { PlatformApiError } from '@/lib/platform/errors';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import Loading from '@/components/Loading';
import Alert from '@/components/Alert';
import { useAlert } from '@/hooks/useAlert';

export default function PlatformLoginPage() {
  const { user, loading: authLoading, login } = usePlatformAuth();
  const router = useRouter();
  const { alert, showAlert, closeAlert } = useAlert();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/platform');
    }
  }, [authLoading, user, router]);

  const rateBlocked =
    rateLimitedUntil !== null && Date.now() < rateLimitedUntil;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rateBlocked || submitting) return;
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      setPassword('');
      router.replace('/platform');
    } catch (err) {
      const msg = mapPlatformErrorToUserMessage(err);
      const status = err instanceof PlatformApiError ? err.status : undefined;
      const code = err instanceof PlatformApiError ? err.code : undefined;
      if (status === 429 || code === 'RATE_LIMITED') {
        setRateLimitedUntil(Date.now() + 60_000);
        showAlert(
          'warning',
          'Too many attempts',
          `${msg} Please wait about a minute before trying again — do not spam retries.`
        );
      } else if (status === 401 || code === 'UNAUTHORIZED') {
        showAlert('error', 'Invalid credentials', msg || 'Email or password is incorrect.');
      } else if (status && status >= 500) {
        showAlert(
          'error',
          'Server error',
          msg || 'Platform login failed due to a server issue. Please try again shortly.'
        );
      } else {
        showAlert('error', 'Sign-in failed', msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return <Loading message="Checking session…" fullScreen size="lg" />;
  }

  if (user) {
    return null;
  }

  return (
    <>
      <Alert
        isOpen={alert.isOpen}
        onClose={closeAlert}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        duration={alert.type === 'warning' ? 8000 : 5000}
      />
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-light-gray-dark p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple">FitNix Platform</p>
          <h1 className="mt-1 text-2xl font-bold text-dark-gray">Operator sign-in</h1>
          <p className="mt-2 text-sm text-dark-gray-light">
            This login is separate from gym staff accounts. Use platform credentials only.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-gray mb-1">Email</label>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-light-gray-dark px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-gray mb-1">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-light-gray-dark px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
            </div>
            {rateBlocked && (
              <p className="text-sm text-warning-dark">
                Rate limit active — wait before trying again.
              </p>
            )}
            <button
              type="submit"
              disabled={submitting || rateBlocked}
              className="w-full rounded-lg bg-purple py-3 text-white font-medium hover:bg-purple-dark disabled:opacity-50"
            >
              {submitting ? 'Signing in…' : rateBlocked ? 'Please wait…' : 'Sign in'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-dark-gray-light">
            <Link href="/login" className="text-primary hover:underline">
              Gym admin portal
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

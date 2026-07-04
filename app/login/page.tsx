'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/Loading';
import FitNixLogo from '@/components/FitNixLogo';

const highlights = [
  {
    title: 'Member management',
    description: 'Track memberships, renewals, and attendance in one place.',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: 'Payments & reports',
    description: 'Monitor revenue, dues, and daily gym performance at a glance.',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    title: 'Built for gym teams',
    description: 'Role-based access so staff see only what they need.',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
];

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    const s = q.get('session');
    if (s === 'expired') {
      setSessionNotice('Your session has expired. Please sign in again.');
    } else if (s === 'invalid') {
      setSessionNotice('Your session is no longer valid. Please sign in again.');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Brand panel */}
      <div className="relative hidden lg:flex lg:w-[46%] xl:w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-primary-dark via-primary to-primary-light p-12 text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-dark-gray/20 blur-3xl" />
        <div className="pointer-events-none absolute right-12 top-1/3 h-40 w-40 rounded-full bg-white/5 ring-1 ring-white/10" />

        <div className="relative z-10">
          <FitNixLogo
            tone="onBrand"
            size="lg"
            subtitle="Gym management platform"
            titleClassName="text-white text-xl"
            subtitleClassName="text-white/75 text-sm"
          />
        </div>

        <div className="relative z-10 my-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Admin portal</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            Run your gym
            <br />
            <span className="text-white/90">with confidence.</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/80">
            Sign in to manage members, trainers, billing, and daily operations from a single dashboard.
          </p>
        </div>

        <ul className="relative z-10 space-y-5">
          {highlights.map((item) => (
            <li key={item.title} className="flex gap-4">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                {item.icon}
              </div>
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-white/70">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 flex-col items-center justify-center bg-light-gray-light px-6 py-12 sm:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />

        <div className="relative w-full max-w-md">
          {/* Mobile brand */}
          <div className="mb-8 flex justify-center lg:hidden">
            <FitNixLogo size="md" subtitle="Admin Portal" />
          </div>

          <div className="rounded-2xl border border-light-gray-dark/60 bg-white p-8 shadow-xl shadow-dark-gray/5 sm:p-10">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-dark-gray">Welcome back</h2>
              <p className="mt-2 text-sm text-dark-gray-light">
                Enter your credentials to access your gym dashboard.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {sessionNotice && (
                <div
                  role="status"
                  className="flex gap-3 rounded-xl border border-info/20 bg-info/5 px-4 py-3 text-sm text-info-dark"
                >
                  <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{sessionNotice}</span>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="flex gap-3 rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error-dark"
                >
                  <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-dark-gray">
                  Username
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-dark-gray-light/60">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                    className="w-full rounded-xl border border-light-gray-dark bg-light-gray-light/50 py-3 pl-11 pr-4 text-dark-gray outline-none transition placeholder:text-dark-gray-light/50 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
                    placeholder="Enter your username"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-dark-gray">
                  Password
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-dark-gray-light/60">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-light-gray-dark bg-light-gray-light/50 py-3 pl-11 pr-4 text-dark-gray outline-none transition placeholder:text-dark-gray-light/50 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full overflow-hidden rounded-xl bg-primary py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary-dark hover:shadow-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="relative flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <Loading inline size="sm" message="" />
                      <span>Signing in…</span>
                    </>
                  ) : (
                    <>
                      <span>Sign in</span>
                      <svg className="h-4 w-4 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </span>
              </button>
            </form>
          </div>

          <p className="mt-8 text-center text-sm text-dark-gray-light">
            Platform operator?{' '}
            <Link href="/platform/login" className="font-medium text-primary hover:text-primary-dark hover:underline">
              Sign in to the platform portal
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

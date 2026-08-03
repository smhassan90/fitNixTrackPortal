'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Outfit } from 'next/font/google';
import { useAuth } from '@/contexts/AuthContext';
import { canGymPermission, isGymAdmin } from '@/lib/gymRoles';
import { firstAllowedGymPath } from '@/lib/gymRouteAccess';
import Loading from '@/components/Loading';
import FitNixLogo from '@/components/FitNixLogo';

const displayFont = Outfit({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
});

const highlights = [
  {
    title: 'Member management',
    description: 'Memberships, renewals, and attendance in one place.',
  },
  {
    title: 'Payments & reports',
    description: 'Revenue, dues, and daily performance at a glance.',
  },
  {
    title: 'Built for gym teams',
    description: 'Role-based access so staff see only what they need.',
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
      const storedUser = localStorage.getItem('user');
      let dest = '/attendance';
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser) as Record<string, unknown>;
          dest = firstAllowedGymPath(
            (key) => canGymPermission(parsed, key),
            isGymAdmin(parsed.role as string)
          );
        } catch {
          /* keep attendance fallback */
        }
      }
      router.push(dest);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Brand panel — deep forest → brand green */}
      <div className="relative hidden overflow-hidden bg-primary-dark lg:flex lg:w-[46%] xl:w-1/2 lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 90% 70% at 0% 0%, rgb(93 214 44 / 0.35), transparent 55%), radial-gradient(ellipse 70% 55% at 100% 100%, rgb(26 70 10 / 0.65), transparent 55%), linear-gradient(155deg, #245a12 0%, #337418 42%, #3f9a1f 78%, #4fc228 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="pointer-events-none absolute -right-16 top-[20%] h-80 w-80 rounded-full bg-primary/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-[#1a450c]/50 blur-3xl" />

        <div className="relative z-10 p-12">
          <FitNixLogo
            tone="onBrand"
            size="lg"
            subtitle="Gym management platform"
            titleClassName="text-white text-xl"
            subtitleClassName="text-white/70 text-sm"
          />
        </div>

        <div className={`relative z-10 px-12 ${displayFont.className}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">
            Admin portal
          </p>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight text-white xl:text-5xl">
            Run your gym
            <br />
            with confidence.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/75">
            Manage members, trainers, billing, and daily operations from one calm dashboard.
          </p>
        </div>

        <ul className="relative z-10 space-y-4 p-12 pt-8">
          {highlights.map((item) => (
            <li key={item.title} className="flex gap-3.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
              <div>
                <p className={`${displayFont.className} text-sm font-semibold text-white`}>
                  {item.title}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-white/70">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 flex-col items-center justify-center bg-[#f3faf0] px-4 py-10 sm:px-8 lg:px-10">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 55% 45% at 100% 0%, rgb(93 214 44 / 0.14), transparent 60%), radial-gradient(ellipse 40% 35% at 0% 100%, rgb(51 116 24 / 0.08), transparent 55%)',
          }}
        />

        <div className="relative w-full max-w-[400px]">
          <div className="mb-8 flex justify-center lg:hidden">
            <FitNixLogo size="md" subtitle="Admin Portal" />
          </div>

          <div className="rounded-2xl border border-ink/10 bg-white p-6 shadow-[0_20px_50px_-24px_rgba(15,15,15,0.35)] sm:p-8">
            <div className={`mb-7 ${displayFont.className}`}>
              <h2 className="text-2xl font-extrabold tracking-tight text-ink">Welcome back</h2>
              <p className="mt-2 text-sm font-medium text-ink/50">
                Sign in to your gym dashboard.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {sessionNotice && (
                <div
                  role="status"
                  className="rounded-xl border border-ink/10 bg-ink/[0.03] px-4 py-3 text-sm text-ink/70"
                >
                  {sessionNotice}
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-ink">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full rounded-xl border border-ink/12 bg-canvas px-4 py-3 text-ink outline-none transition placeholder:text-ink/35 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/25"
                  placeholder="Enter your username"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-ink/12 bg-canvas px-4 py-3 text-ink outline-none transition placeholder:text-ink/35 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/25"
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-1 w-full rounded-xl bg-primary-dark py-3.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loading inline size="sm" message="" />
                    Signing in…
                  </span>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
          </div>

          <p className="mt-8 text-center text-sm text-ink/45">
            Platform operator?{' '}
            <Link
              href="/platform/login"
              className="font-semibold text-primary-dark underline-offset-2 hover:text-primary hover:underline"
            >
              Sign in to the platform portal
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

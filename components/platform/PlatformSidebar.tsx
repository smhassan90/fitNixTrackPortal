'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePlatformAuth, useIsPlatformSuperAdmin } from '@/contexts/PlatformAuthContext';

const links = [
  { href: '/platform', label: 'Home' },
  { href: '/platform/gyms', label: 'Gyms' },
  { href: '/platform/billing', label: 'Billing' },
  { href: '/platform/reports', label: 'Reports' },
];

export default function PlatformSidebar() {
  const pathname = usePathname();
  const { user, logout } = usePlatformAuth();
  const isSuper = useIsPlatformSuperAdmin();

  return (
    <aside className="w-64 shrink-0 border-r border-dark-gray-light/20 bg-dark-gray text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-white/10">
        <p className="text-xs uppercase tracking-wider text-white/60">FitNix</p>
        <h1 className="text-lg font-semibold">Platform</h1>
        <p className="text-xs text-white/50 mt-1">Operator console</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {links.map((l) => {
          const active = pathname === l.href || (l.href !== '/platform' && pathname.startsWith(l.href));
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                active ? 'bg-primary text-white' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              {l.label}
            </Link>
          );
        })}
        {isSuper && (
          <>
            <Link
              href="/platform/catalog"
              className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                pathname.startsWith('/platform/catalog')
                  ? 'bg-primary text-white'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              Catalog
            </Link>
            <Link
              href="/platform/users"
              className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                pathname.startsWith('/platform/users')
                  ? 'bg-primary text-white'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              Platform team
            </Link>
            <Link
              href="/platform/audit"
              className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                pathname.startsWith('/platform/audit')
                  ? 'bg-primary text-white'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              Audit log
            </Link>
          </>
        )}
      </nav>
      <div className="p-4 border-t border-white/10 text-sm">
        <p className="font-medium truncate">{user?.name}</p>
        <p className="text-xs text-white/50 truncate">{user?.email}</p>
        <p className="text-xs text-primary-light mt-1">{user?.role}</p>
        <button
          type="button"
          onClick={() => logout()}
          className="mt-3 w-full rounded-lg bg-white/10 py-2 text-xs hover:bg-white/20"
        >
          Sign out
        </button>
        <Link
          href="/login"
          className="mt-2 block text-center text-xs text-white/40 hover:text-white/70"
        >
          Gym portal login →
        </Link>
      </div>
    </aside>
  );
}

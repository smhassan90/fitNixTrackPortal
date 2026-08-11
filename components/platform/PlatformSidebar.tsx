'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePlatformAuth, useIsPlatformSuperAdmin } from '@/contexts/PlatformAuthContext';
import FitNixLogo from '@/components/FitNixLogo';

const links = [
  { href: '/platform', label: 'Home' },
  { href: '/platform/gyms', label: 'Gyms' },
  { href: '/platform/billing', label: 'Billing' },
  { href: '/platform/reports', label: 'Reports' },
];

export default function PlatformSidebar({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const { user, logout } = usePlatformAuth();
  const isSuper = useIsPlatformSuperAdmin();

  const navRef = useRef<HTMLElement>(null);
  const [scrollFades, setScrollFades] = useState({ top: false, bottom: false });

  const updateScrollFades = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const overflow = scrollHeight - clientHeight > 1;
    setScrollFades({
      top: overflow && scrollTop > 4,
      bottom: overflow && scrollTop + clientHeight < scrollHeight - 4,
    });
  }, []);

  useEffect(() => {
    updateScrollFades();
    const el = navRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateScrollFades);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isSuper, updateScrollFades]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (window.innerWidth >= 1024 || !isOpen) return;
      const target = event.target as HTMLElement;
      if (!target.closest('.platform-sidebar-container') && !target.closest('.platform-sidebar-toggle')) {
        onToggle();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside as EventListener);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside as EventListener);
    };
  }, [isOpen, onToggle]);

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/45 lg:hidden" onClick={onToggle} />}
      <aside
        className={`platform-sidebar-container fixed left-0 top-0 z-50 flex h-screen w-64 flex-col overflow-hidden border-r border-white/10 bg-ink text-white shadow-2xl transition-transform duration-300 lg:shadow-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
      <div className="border-b border-white/10 p-6 shrink-0">
        <FitNixLogo
          size="sm"
          subtitle="Platform · Operator console"
          titleClassName="text-white"
          subtitleClassName="text-white/50"
        />
        <button
          type="button"
          onClick={onToggle}
          className="platform-sidebar-toggle absolute right-4 top-5 rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close platform sidebar"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="relative flex-1 min-h-0">
        {scrollFades.top && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-dark-gray to-transparent"
          />
        )}
        <nav
          ref={navRef}
          onScroll={updateScrollFades}
          className="h-full overflow-y-auto sidebar-scroll p-3 space-y-1"
        >
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== '/platform' && pathname.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) onToggle();
                }}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? 'bg-primary text-ink' : 'text-white/80 hover:bg-white/10'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          {isSuper && (
            <>
              <Link
                href="/platform/marketing"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) onToggle();
                }}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                  pathname.startsWith('/platform/marketing')
                    ? 'bg-primary text-ink'
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                Marketing
              </Link>
              <Link
                href="/platform/pos/catalog"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) onToggle();
                }}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                  pathname.startsWith('/platform/pos/catalog')
                    ? 'bg-primary text-ink'
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                POS catalog
              </Link>
              <Link
                href="/platform/pos/analytics"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) onToggle();
                }}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                  pathname.startsWith('/platform/pos/analytics')
                    ? 'bg-primary text-ink'
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                POS analytics
              </Link>
              <Link
                href="/platform/catalog"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) onToggle();
                }}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                  pathname.startsWith('/platform/catalog')
                    ? 'bg-primary text-ink'
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                Catalog
              </Link>
              <Link
                href="/platform/users"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) onToggle();
                }}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                  pathname.startsWith('/platform/users')
                    ? 'bg-primary text-ink'
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                Platform team
              </Link>
              <Link
                href="/platform/audit"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) onToggle();
                }}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                  pathname.startsWith('/platform/audit')
                    ? 'bg-primary text-ink'
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                Audit log
              </Link>
            </>
          )}
        </nav>
        {scrollFades.bottom && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5 bg-gradient-to-t from-dark-gray to-transparent"
          />
        )}
      </div>
      <div className="p-4 border-t border-white/10 text-sm shrink-0">
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
    </>
  );
}

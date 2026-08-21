'use client';

import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useGymSettings } from '@/contexts/GymSettingsContext';
import FitNixLogo from '@/components/FitNixLogo';
import { isGymAdmin } from '@/lib/gymRoles';
import { firstPosPath, hasAnyPosPermission } from '@/lib/pos/permissions';
import { resolveGymLogoUrl } from '@/lib/resolveMediaUrl';
import { contrastTextClassOn, isLightColor, resolveTheme } from '@/lib/theme';

type NavItem = {
  name: string;
  href: string;
  icon: ReactNode;
  /** Required permission; omit for always-visible (Attendance). */
  permission?: string;
  /** Show when user has any POS permission. */
  posNav?: boolean;
  /** Only GYM_ADMIN (Import). */
  adminOnly?: boolean;
};

const teamNavItem: NavItem = {
  name: 'Team',
  href: '/team',
  permission: 'gym.team.manage',
  icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  ),
};

const packageFeaturesNavItem: NavItem = {
  name: 'Package features',
  href: '/packages/features',
  permission: 'gym.packageFeatures.manage',
  icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  ),
};

const navigation: NavItem[] = [
  { 
    name: 'Dashboard', 
    href: '/dashboard',
    permission: 'gym.dashboard.read',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )
  },
  { 
    name: 'Members', 
    href: '/members',
    permission: 'gym.members.read',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    )
  },
  { 
    name: 'Trainers', 
    href: '/trainers',
    permission: 'gym.trainers.read',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  },
  {
    name: 'Employees',
    href: '/employees',
    permission: 'gym.employees.read',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    name: 'Staff attendance',
    href: '/employee-attendance',
    permission: 'gym.employeeAttendance.read',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  { 
    name: 'Packages', 
    href: '/packages',
    permission: 'gym.packages.read',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    )
  },
  { 
    name: 'Attendance', 
    href: '/attendance',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  { 
    name: 'Payments', 
    href: '/payments',
    permission: 'gym.payments.read',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    name: 'Expenses',
    href: '/expenses',
    permission: 'gym.expenses.read',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
  },
  {
    name: 'Expense Heads',
    href: '/expenses/heads',
    permission: 'gym.expenses.read',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  {
    name: 'Point of Sale',
    href: '/pos/checkout',
    posNav: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  { 
    name: 'Reports', 
    href: '/reports',
    permission: 'gym.financialReports.read',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  },
  {
    name: 'Profit & Loss',
    href: '/reports/pnl',
    permission: 'gym.financialReports.read',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
      </svg>
    ),
  },
  { 
    name: 'Settings', 
    href: '/settings',
    permission: 'gym.settings.read',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout, can } = useAuth();
  const { settings, gymTheme } = useGymSettings();
  const admin = isGymAdmin(user?.role);

  const gymLogoUrl = resolveGymLogoUrl(settings?.gym.logoUrl || user?.gymLogoUrl);
  const gymDisplayName = settings?.gym.name?.trim() || user?.gymName?.trim() || 'Gym';
  const [logoFailed, setLogoFailed] = useState(false);

  const primary = resolveTheme(gymTheme).primary;
  const activeNavTextClass = contrastTextClassOn(primary);
  const activeNavBarClass = isLightColor(primary) ? 'bg-ink/40' : 'bg-white/50';
  const primaryOnDarkHover =
    activeNavTextClass === 'text-ink'
      ? 'hover:bg-primary-dark hover:text-white active:bg-primary-dark'
      : 'hover:bg-primary-dark active:bg-primary-dark';

  useEffect(() => {
    setLogoFailed(false);
  }, [gymLogoUrl]);

  const navItems = useMemo(() => {
    const items = [...navigation];
    const packagesIdx = items.findIndex((i) => i.href === '/packages');
    if (packagesIdx >= 0) {
      items.splice(packagesIdx + 1, 0, packageFeaturesNavItem);
    }
    const settingsIdx = items.findIndex((i) => i.href === '/settings');
    if (settingsIdx >= 0) {
      items.splice(settingsIdx, 0, teamNavItem);
    }

    return items
      .map((item) => (item.posNav ? { ...item, href: firstPosPath(can) } : item))
      .filter((item) => {
      if (item.adminOnly) return admin;
      if (item.posNav) return hasAnyPosPermission(can);
      if (!item.permission) return true; // Attendance always
      return can(item.permission);
    });
  }, [can, admin]);

  // Close sidebar when clicking outside on mobile/tablet
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close on mobile/tablet (screens less than 1024px - tablets and phones)
      if (window.innerWidth < 1024 && isOpen) {
        const target = event.target as HTMLElement;
        // Don't close if clicking inside sidebar or on toggle button
        if (!target.closest('.sidebar-container') && !target.closest('.sidebar-toggle')) {
          onToggle();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Also handle touch events for mobile devices
      document.addEventListener('touchstart', handleClickOutside as any);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside as any);
    };
  }, [isOpen, onToggle]);

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
  }, [navItems, updateScrollFades]);

  return (
    <>
      {/* Mobile/Tablet Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        sidebar-container
        bg-gradient-to-b from-ink to-surface text-white w-64 h-screen flex flex-col shadow-2xl overflow-hidden fixed left-0 top-0 z-50
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
      {/* Logo Section */}
      <div className="p-6 border-b border-white/10 shrink-0">
        <div className="flex items-center justify-between gap-2">
          {gymLogoUrl && !logoFailed ? (
            <div className="flex min-w-0 flex-1 items-center gap-3" role="img" aria-label={gymDisplayName}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={gymLogoUrl}
                alt=""
                onError={() => setLogoFailed(true)}
                className="h-10 w-10 shrink-0 rounded-xl object-contain bg-white/10 ring-1 ring-white/15"
              />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[15px] font-bold text-white">{gymDisplayName}</p>
                <p className="truncate text-[11px] font-medium text-white/50">Admin Portal</p>
              </div>
            </div>
          ) : (
            <FitNixLogo
              size="sm"
              subtitle={gymDisplayName !== 'Gym' ? gymDisplayName : 'Admin Portal'}
              titleClassName="text-white"
              subtitleClassName="text-white/50"
            />
          )}
          {/* Close/Toggle button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="shrink-0 text-white/50 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
            title="Toggle sidebar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Navigation — fixed header/footer with scrollable middle */}
      <div className="relative flex-1 min-h-0">
        {scrollFades.top && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-ink to-transparent"
          />
        )}
        <nav
          ref={navRef}
          onScroll={updateScrollFades}
          className="h-full overflow-y-auto sidebar-scroll p-4"
        >
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/' &&
                  pathname.startsWith(`${item.href}/`) &&
                  !navItems.some(
                    (other) =>
                      other.href !== item.href &&
                      other.href.startsWith(`${item.href}/`) &&
                      (pathname === other.href || pathname.startsWith(`${other.href}/`))
                  ));
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={() => {
                      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                        onToggle();
                      }
                    }}
                    className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 group ${
                      isActive
                        ? `bg-primary ${activeNavTextClass} shadow-md shadow-primary/20`
                        : 'text-white hover:bg-white/10 hover:translate-x-1'
                    }`}
                  >
                    <span className={`mr-3 ${isActive ? activeNavTextClass : 'text-white'}`}>
                      {item.icon}
                    </span>
                    <span className="font-medium">{item.name}</span>
                    {isActive && (
                      <span className={`ml-auto h-6 w-1.5 rounded-full ${activeNavBarClass}`} />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {scrollFades.bottom && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5 bg-gradient-to-t from-surface to-transparent"
          />
        )}
      </div>

      {/* User Section */}
      <div className="p-4 border-t border-white/10 bg-surface shrink-0">
        <div className="mb-4 p-3 bg-white/5 rounded-xl ring-1 ring-white/10">
          <div className="flex items-center space-x-3 mb-2">
            <div className="bg-primary w-10 h-10 rounded-full flex items-center justify-center">
              <span className={`${activeNavTextClass} font-semibold text-sm`}>
                {user?.name?.charAt(0).toUpperCase() || 'A'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
              <p className="text-xs text-white/45 truncate">{user?.gymName}</p>
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className={`w-full bg-primary ${activeNavTextClass} py-2.5 px-4 rounded-xl ${primaryOnDarkHover} transition-all duration-200 text-sm font-semibold shadow-lg flex items-center justify-center space-x-2`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Logout</span>
        </button>
      </div>
    </div>
    </>
  );
}

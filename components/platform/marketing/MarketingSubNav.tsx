'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
  /** Exact match only (e.g. overview at /platform/marketing/[id]) */
  exact?: boolean;
  /** Shown but not yet implemented */
  disabled?: boolean;
};

function buildItems(gymId: string): NavItem[] {
  const base = `/platform/marketing/${gymId}`;
  return [
    { href: base, label: 'Overview', exact: true },
    { href: `${base}/profile`, label: 'Profile' },
    { href: `${base}/opportunities`, label: 'Opportunities', disabled: true },
    { href: `${base}/social`, label: 'Social Media', disabled: true },
    { href: `${base}/blogs`, label: 'Blogs & SEO', disabled: true },
    { href: `${base}/calendar`, label: 'Calendar', disabled: true },
  ];
}

export default function MarketingSubNav({
  gymId,
  gymName,
}: {
  gymId: string;
  gymName?: string;
}) {
  const pathname = usePathname();
  const items = buildItems(gymId);

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-dark-gray-light">
            Marketing
          </p>
          <h1 className="text-2xl font-bold text-dark-gray">
            {gymName || `Gym #${gymId}`}
          </h1>
        </div>
        <Link
          href="/platform/marketing"
          className="text-sm text-dark-gray-light underline-offset-2 hover:text-dark-gray hover:underline"
        >
          Change gym
        </Link>
      </div>
      <nav className="flex flex-wrap gap-1 border-b border-light-gray-dark pb-px">
        {items.map((item) => {
          if (item.disabled) {
            return (
              <span
                key={item.href}
                title="Coming in a later phase"
                className="cursor-not-allowed rounded-t-lg px-3 py-2 text-sm text-dark-gray-light/50"
              >
                {item.label}
              </span>
            );
          }
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-t-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? 'border-b-2 border-primary font-medium text-dark-gray'
                  : 'text-dark-gray-light hover:text-dark-gray'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

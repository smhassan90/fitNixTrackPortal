'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { POS_PERMISSION_KEYS } from '@/lib/pos/permissions';

const tabs = [
  { href: '/pos/setup', label: 'Setup', permission: POS_PERMISSION_KEYS.productsManage },
  { href: '/pos/products', label: 'Products', permission: POS_PERMISSION_KEYS.catalogRead },
  { href: '/pos/checkout', label: 'Checkout', permission: POS_PERMISSION_KEYS.sell },
  { href: '/pos/sales', label: 'Sales', permission: POS_PERMISSION_KEYS.catalogRead },
  { href: '/pos/reports', label: 'Reports', permission: POS_PERMISSION_KEYS.revenueRead },
];

export default function PosSubNav() {
  const pathname = usePathname();
  const { can } = useAuth();
  const visible = tabs.filter((t) => can(t.permission));

  if (visible.length === 0) return null;

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-3">
      {visible.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

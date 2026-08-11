'use client';

import Link from 'next/link';
import { useIsPlatformSuperAdmin } from '@/contexts/PlatformAuthContext';

/**
 * Marketing is Super Admin only. PLATFORM_SUPPORT must not see or use these pages.
 */
export default function MarketingSuperAdminGate({ children }: { children: React.ReactNode }) {
  const isSuper = useIsPlatformSuperAdmin();

  if (!isSuper) {
    return (
      <div className="rounded-xl border border-light-gray-dark bg-white p-8 shadow">
        <h1 className="text-xl font-bold text-dark-gray">Marketing</h1>
        <p className="mt-2 text-sm text-dark-gray-light">
          This internal marketing workstation is available to Super Admins only.
        </p>
        <Link
          href="/platform"
          className="mt-6 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-ink hover:opacity-90"
        >
          Back to platform home
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

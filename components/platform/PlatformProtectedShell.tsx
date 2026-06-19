'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { usePlatformAuth } from '@/contexts/PlatformAuthContext';
import Loading from '@/components/Loading';
import PlatformSidebar from '@/components/platform/PlatformSidebar';
import PlatformSessionBanner from '@/components/platform/PlatformSessionBanner';
import { platformLoginUrl } from '@/lib/platform/sessionRedirect';

export default function PlatformProtectedShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = usePlatformAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && pathname !== '/platform/login') {
      router.replace(platformLoginUrl('expired'));
    }
  }, [loading, user, router, pathname]);

  if (loading) {
    return <Loading message="Loading platform session…" fullScreen size="lg" />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen">
      <PlatformSidebar />
      <div className="flex-1 overflow-x-auto">
        <div className="max-w-7xl mx-auto p-6 md:p-8">
          <PlatformSessionBanner />
          {children}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user && pathname !== '/platform/login') {
      router.replace(platformLoginUrl('expired'));
    }
  }, [loading, user, router, pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncSidebar = () => {
      setSidebarOpen(window.innerWidth >= 1024);
    };
    syncSidebar();
    window.addEventListener('resize', syncSidebar);
    return () => window.removeEventListener('resize', syncSidebar);
  }, []);

  if (loading) {
    return <Loading message="Loading platform session…" fullScreen size="lg" />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-[#ECF0F1]">
      <PlatformSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen((open) => !open)} />
      {!sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="fixed left-4 top-4 z-30 rounded-xl bg-dark-gray p-2.5 text-white shadow-lg transition hover:bg-dark-gray-light lg:hidden"
          aria-label="Open platform sidebar"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}
      <div className={`min-w-0 flex-1 overflow-x-hidden transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}`}>
        <div className={`mx-auto max-w-7xl ${sidebarOpen ? 'px-4 pb-6 pt-4 sm:px-5 sm:pb-8 sm:pt-5 lg:p-8' : 'px-4 pb-6 pt-20 sm:px-5 sm:pb-8 sm:pt-20 lg:p-8'}`}>
          <PlatformSessionBanner />
          {children}
        </div>
      </div>
    </div>
  );
}

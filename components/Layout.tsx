'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Loading from './Loading';
import { isGymAdmin } from '@/lib/gymRoles';
import { firstAllowedGymPath, isGymRouteAllowed } from '@/lib/gymRouteAccess';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading, can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const redirectedRef = useRef<string | null>(null);

  const admin = Boolean(user && isGymAdmin(user.role));
  const routeAllowed = user ? isGymRouteAllowed(pathname || '', can, admin) : true;

  // Initialize sidebar state from localStorage or default based on screen size
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarOpen');
      if (saved !== null) {
        return saved === 'true';
      }
      // Default: open on desktop, closed on mobile
      return window.innerWidth >= 768;
    }
    return false;
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Route-level permission guard
  useEffect(() => {
    if (loading || !user) return;
    if (routeAllowed) {
      redirectedRef.current = null;
      return;
    }
    const dest = firstAllowedGymPath(can, admin);
    if (dest !== pathname && redirectedRef.current !== pathname) {
      redirectedRef.current = pathname;
      // Silent redirect — limited access is normal for team roles, not an error.
      router.replace(dest);
    }
  }, [loading, user, pathname, can, router, routeAllowed, admin]);

  // Save sidebar state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarOpen', sidebarOpen.toString());
    }
  }, [sidebarOpen]);

  // Handle window resize - only adjust on mobile/tablet
  useEffect(() => {
    const handleResize = () => {
      // Only auto-close on mobile/tablet (screens less than 1024px), preserve desktop state
      if (window.innerWidth < 1024 && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  if (loading) {
    return <Loading message="Initializing..." fullScreen size="lg" />;
  }

  if (!user) {
    return null;
  }

  if (!routeAllowed) {
    return <Loading message="Loading…" fullScreen size="lg" />;
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />

      {/* Toggle Button - Always visible when sidebar is closed */}
      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="sidebar-toggle fixed left-4 top-4 z-30 rounded-xl bg-primary p-2.5 text-ink shadow-lg transition-colors hover:bg-primary-dark active:bg-primary-dark hover:text-white lg:top-6"
          title="Open sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      <main
        className={`flex-1 min-w-0 overflow-x-hidden transition-all duration-300 ${
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-0'
        } ${sidebarOpen ? 'px-4 pb-6 pt-4 sm:px-5 sm:pb-8 sm:pt-5 lg:p-8' : 'px-4 pb-6 pt-20 sm:px-5 sm:pb-8 sm:pt-20 lg:px-8 lg:pb-8 lg:pt-8'}`}
      >
        {children}
      </main>
    </div>
  );
}

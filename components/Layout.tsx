'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Loading from './Loading';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  
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

  return (
    <div className="flex min-h-screen">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      
      {/* Toggle Button - Always visible when sidebar is closed */}
      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="sidebar-toggle fixed top-6 left-4 z-30 bg-primary text-white p-2 rounded-lg shadow-lg hover:bg-opacity-90 transition-colors"
          title="Open sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}
      
      <main className={`flex-1 transition-all duration-300 overflow-x-hidden ${sidebarOpen ? 'md:ml-64' : 'md:ml-0'} ${!sidebarOpen ? 'pl-14 pt-20 md:pl-8 md:pt-8' : 'p-4 md:p-8'}`}>
        {children}
      </main>
    </div>
  );
}



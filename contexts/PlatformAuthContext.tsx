'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { PLATFORM_USER_KEY } from '@/lib/platform/constants';
import {
  clearPlatformSession,
  readPlatformToken,
  writePlatformSession,
} from '@/lib/platform/platformClient';
import { platformAuthLogin, platformAuthLogout, platformAuthMe } from '@/lib/platform/platformApi';
import type { PlatformUser } from '@/lib/platform/types';

interface PlatformAuthContextValue {
  user: PlatformUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const PlatformAuthContext = createContext<PlatformAuthContextValue | undefined>(undefined);

export function PlatformAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = readPlatformToken();
    if (!token) {
      setUser(null);
      return;
    }
    const me = await platformAuthMe();
    setUser(me);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(PLATFORM_USER_KEY, JSON.stringify(me));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = readPlatformToken();
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        await refreshUser();
      } catch {
        clearPlatformSession();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await platformAuthLogin(email, password);
    writePlatformSession(data.token, JSON.stringify(data.user));
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await platformAuthLogout();
    } catch {
      /* still clear client session */
    } finally {
      clearPlatformSession();
      setUser(null);
    }
  }, []);

  return (
    <PlatformAuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </PlatformAuthContext.Provider>
  );
}

export function usePlatformAuth() {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) throw new Error('usePlatformAuth must be used within PlatformAuthProvider');
  return ctx;
}

export function useIsPlatformSuperAdmin(): boolean {
  const { user } = usePlatformAuth();
  return user?.role === 'SUPER_ADMIN';
}

'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchGymSettings, type GymSettings } from '@/lib/attendanceApi';

interface GymSettingsContextType {
  settings: GymSettings | null;
  gymTimezone: string | null;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const GymSettingsContext = createContext<GymSettingsContextType | undefined>(undefined);

export function GymSettingsProvider({ children }: { children: React.ReactNode }) {
  const { token, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<GymSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    if (!token) {
      setSettings(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchGymSettings();
      setSettings(data);
    } catch {
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    void refreshSettings();
  }, [authLoading, refreshSettings]);

  const gymTimezone = settings?.gym.timezone?.trim() || null;

  const value = useMemo(
    () => ({
      settings,
      gymTimezone,
      loading: authLoading || loading,
      refreshSettings,
    }),
    [settings, gymTimezone, authLoading, loading, refreshSettings]
  );

  return <GymSettingsContext.Provider value={value}>{children}</GymSettingsContext.Provider>;
}

export function useGymSettings() {
  const context = useContext(GymSettingsContext);
  if (context === undefined) {
    throw new Error('useGymSettings must be used within a GymSettingsProvider');
  }
  return context;
}

/** Gym IANA timezone from settings API (null while loading or if unset). */
export function useGymTimezone(): string | null {
  return useGymSettings().gymTimezone;
}

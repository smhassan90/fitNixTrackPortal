'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

/**
 * Loads member photo URLs in the background so list pages stay interactive.
 * Avatars should show their own per-image spinner once a URL is available.
 */
export function useMemberPhotoMap(): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await api.get('/api/members?limit=1000');
        if (cancelled || !response.data?.success) return;
        const members = (response.data.data?.members || []) as Record<string, unknown>[];
        const next: Record<string, string> = {};
        for (const m of members) {
          const id = m.id != null ? String(m.id) : '';
          const photoUrl = typeof m.photoUrl === 'string' ? m.photoUrl.trim() : '';
          if (id && photoUrl) next[id] = photoUrl;
        }
        if (!cancelled) setMap(next);
      } catch {
        /* photos are optional; keep page usable */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return map;
}

export function photoUrlFromMap(
  photoMap: Record<string, string>,
  memberId: string | number | null | undefined,
  fallback?: string | null
): string | null {
  if (typeof fallback === 'string' && fallback.trim()) return fallback.trim();
  if (memberId == null || memberId === '') return null;
  return photoMap[String(memberId)] ?? null;
}

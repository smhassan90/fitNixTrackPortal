/**
 * Turn a relative media path into an absolute URL for <img src>.
 * Absolute http(s) URLs are returned unchanged.
 *
 * - `/gym-logos/...` is hosted by this Next app (upload-logo route) → use app origin
 * - other relative paths are usually backend media → use NEXT_PUBLIC_API_URL
 */
export function resolveMediaUrl(url?: string | null): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (/^data:/i.test(u) || /^blob:/i.test(u)) return u;

  if (u.startsWith('/')) {
    const isPortalAsset =
      u.startsWith('/gym-logos/') ||
      u.startsWith('/uploads/') ||
      u.startsWith('/_next/') ||
      u.startsWith('/logo');

    if (isPortalAsset) {
      const appBase = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
      if (appBase) return `${appBase}${u}`;
      if (typeof window !== 'undefined') return `${window.location.origin}${u}`;
      return u;
    }

    const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
    if (apiBase) return `${apiBase}${u}`;
    if (typeof window !== 'undefined') return `${window.location.origin}${u}`;
    return u;
  }

  return u;
}

/** Prefer for gym logos (portal upload or absolute blob URL). */
export function resolveGymLogoUrl(url?: string | null): string | null {
  return resolveMediaUrl(url);
}

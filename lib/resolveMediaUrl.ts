/**
 * Turn a relative media path from the API into an absolute URL for <img src>.
 * Absolute http(s) URLs are returned unchanged.
 */
export function resolveMediaUrl(url?: string | null): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('/')) {
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
    if (apiBase) return `${apiBase}${u}`;
    if (typeof window !== 'undefined') return `${window.location.origin}${u}`;
    return u;
  }
  return u;
}

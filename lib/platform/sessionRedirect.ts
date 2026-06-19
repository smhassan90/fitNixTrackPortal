/** Safe post-login redirect within the platform app only. */
export function sanitizePlatformReturnTo(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  if (!raw.startsWith('/platform')) return null;
  if (raw.startsWith('/platform/login')) return null;
  return raw;
}

export function platformLoginUrl(reason: 'expired' | 'invalid' = 'expired'): string {
  if (typeof window === 'undefined') return `/platform/login?session=${reason}`;
  const returnTo = sanitizePlatformReturnTo(
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  );
  const params = new URLSearchParams({ session: reason });
  if (returnTo) params.set('returnTo', returnTo);
  return `/platform/login?${params.toString()}`;
}

/**
 * Client-side JWT payload decode (no signature verify) — for session UX only.
 * Do not use for security decisions; the server must always validate the token.
 */

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  if (!token || !token.startsWith('eyJ')) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * True if `exp` is in the past (with small skew for clock drift).
 * Returns false for non-JWT or tokens without `exp`.
 */
export function isJwtExpired(token: string, skewSeconds = 30): boolean {
  if (!token || !token.startsWith('eyJ')) return false;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  return Date.now() / 1000 >= payload.exp - skewSeconds;
}

export function secondsUntilJwtExpiry(token: string): number | null {
  if (!token || !token.startsWith('eyJ')) return null;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return null;
  return Math.max(0, payload.exp - Date.now() / 1000);
}

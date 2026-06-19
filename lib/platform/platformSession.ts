import { isJwtExpired, secondsUntilJwtExpiry } from '@/lib/jwtClient';
import { readPlatformToken } from './platformClient';

/** User-facing message when the platform JWT cannot be used for a mutation. */
export function getPlatformTokenBlockReason(minSecondsLeft = 60): string | null {
  const token = readPlatformToken();
  if (!token) return 'You are not signed in. Please sign in again.';
  if (isJwtExpired(token)) return 'Your platform session has expired. Please sign in again, then retry.';
  const left = secondsUntilJwtExpiry(token);
  if (left !== null && left < minSecondsLeft) {
    return 'Your platform session is about to expire. Sign in again, then retry this action.';
  }
  return null;
}

export function getPlatformSessionSecondsLeft(): number | null {
  const token = readPlatformToken();
  if (!token) return null;
  if (isJwtExpired(token)) return 0;
  return secondsUntilJwtExpiry(token);
}

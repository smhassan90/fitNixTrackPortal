/** Default IANA timezone for new Pakistan gyms (super admin create form). */
export const DEFAULT_GYM_TIMEZONE = 'Asia/Karachi';

/** Map country name (from location catalog) to a suggested IANA timezone. */
export function suggestTimezoneForCountry(country: string): string {
  const normalized = country.trim().toLowerCase();
  if (normalized === 'pakistan') return 'Asia/Karachi';
  if (normalized === 'united arab emirates' || normalized === 'uae') return 'Asia/Dubai';
  if (normalized === 'saudi arabia') return 'Asia/Riyadh';
  if (normalized === 'united kingdom' || normalized === 'uk') return 'Europe/London';
  if (normalized === 'united states' || normalized === 'usa') return 'America/New_York';
  return DEFAULT_GYM_TIMEZONE;
}

/** Format an ISO instant in the gym's IANA timezone (client-side display). */
export function formatDateTimeInGymTimezone(
  isoString: string | null | undefined,
  timeZone: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  const tz = timeZone?.trim() || undefined;
  try {
    return date.toLocaleString('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      ...options,
    });
  } catch {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      ...options,
    });
  }
}

/** Time-only display (e.g. "1:15 PM") in gym timezone. */
export function formatTimeInGymTimezone(
  isoString: string | null | undefined,
  timeZone: string | null | undefined
): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  const tz = timeZone?.trim() || undefined;
  try {
    return date.toLocaleString('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
}

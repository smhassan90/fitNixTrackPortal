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

/** True for UTC / Etc/UTC / GMT+0 style IANA ids (not useful for Pakistan gyms). */
export function isUtcLikeTimezone(timeZone: string | null | undefined): boolean {
  const tz = timeZone?.trim().toUpperCase() ?? '';
  if (!tz) return false;
  return (
    tz === 'UTC' ||
    tz === 'ETC/UTC' ||
    tz === 'ETC/GMT' ||
    tz === 'GMT' ||
    tz === 'GMT+0' ||
    tz === 'GMT-0' ||
    tz === 'ZULU'
  );
}

/** Detect raw ISO-8601 instants (often ending in Z) — never show these to users as-is. */
export function looksLikeUtcIsoInstant(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  // 2024-01-15T10:30:00.000Z or with offset
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return true;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(v) && /[Zz]|[+-]\d{2}:?\d{2}$/.test(v)) {
    return true;
  }
  return false;
}

function resolveDisplayTimeZone(timeZone: string | null | undefined): string {
  const tz = timeZone?.trim();
  return tz || DEFAULT_GYM_TIMEZONE;
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
  const tz = resolveDisplayTimeZone(timeZone);
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
      timeZone: DEFAULT_GYM_TIMEZONE,
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
  const tz = resolveDisplayTimeZone(timeZone);
  try {
    return date.toLocaleString('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return date.toLocaleString('en-US', {
      timeZone: DEFAULT_GYM_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
}

/**
 * Attendance clock display for device + manual punches.
 * Prefer API gym-formatted `checkIn` / `checkOut` / `checkInFormatted`.
 * If missing, format the UTC ISO instant in the gym IANA timezone.
 * Never return raw `…Z` ISO strings.
 */
export function displayAttendanceTime(
  formatted: string | null | undefined,
  isoUtc: string | null | undefined,
  timeZone: string | null | undefined,
  emptyLabel = '—'
): string {
  const pref = formatted?.trim();
  if (pref) {
    if (looksLikeUtcIsoInstant(pref)) {
      return formatTimeInGymTimezone(pref, timeZone);
    }
    return pref;
  }
  const iso = isoUtc?.trim();
  if (iso) return formatTimeInGymTimezone(iso, timeZone);
  return emptyLabel;
}

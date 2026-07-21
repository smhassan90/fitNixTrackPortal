/** Common IANA zones when the API and `Intl.supportedValuesOf` are unavailable. */
const COMMON_TIMEZONES: string[] = [
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/New_York',
  'America/Sao_Paulo',
  'America/Toronto',
  'Asia/Baghdad',
  'Asia/Bangkok',
  'Asia/Dhaka',
  'Asia/Dubai',
  'Asia/Hong_Kong',
  'Asia/Jakarta',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Kuala_Lumpur',
  'Asia/Manila',
  'Asia/Riyadh',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Melbourne',
  'Australia/Sydney',
  'Europe/Berlin',
  'Europe/Istanbul',
  'Europe/London',
  'Europe/Moscow',
  'Europe/Paris',
  'Pacific/Auckland',
  'UTC',
];

/** Full IANA list in the browser (400+ zones), or a curated fallback. */
export function getBrowserTimezoneList(): string[] {
  if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
    try {
      return Intl.supportedValuesOf('timeZone').slice().sort((a, b) => a.localeCompare(b));
    } catch {
      // ignore — use static list below
    }
  }
  return [...COMMON_TIMEZONES].sort((a, b) => a.localeCompare(b));
}

/**
 * Prefer API list from GET /api/platform/timezones; otherwise use browser IANA catalog.
 */
export function resolveTimezoneOptions(apiTimezones?: string[] | null): string[] {
  const fromApi = Array.isArray(apiTimezones)
    ? apiTimezones.map((tz) => tz.trim()).filter((tz) => tz.length > 0 && tz.length <= 64)
    : [];
  if (fromApi.length > 0) {
    return Array.from(new Set(fromApi)).sort((a, b) => a.localeCompare(b));
  }
  return getBrowserTimezoneList();
}

/** Ensure the current value appears in the option list (edit gym with legacy data). */
export function withTimezoneValue(options: string[], value: string | null | undefined): string[] {
  const tz = value?.trim();
  if (!tz || options.includes(tz)) return options;
  return [tz, ...options];
}

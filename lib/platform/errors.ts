import type { AxiosError } from 'axios';

export class PlatformApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, code?: string, message?: string, details?: unknown) {
    super(message || code || 'Request failed');
    this.name = 'PlatformApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function mapPlatformErrorToUserMessage(err: unknown): string {
  if (err instanceof PlatformApiError) {
    return mapCodeToMessage(err.code, err.message, err.details);
  }
  const ax = err as AxiosError<{ error?: { code?: string; message?: string; details?: unknown } }>;
  const status = ax.response?.status;
  const e = ax.response?.data?.error;
  if (status === 429) {
    return mapCodeToMessage('RATE_LIMITED', e?.message, e?.details);
  }
  const fallback = mapCodeToMessage(e?.code, e?.message, e?.details) || ax.message || 'Something went wrong';
  if (fallback.toLowerCase().includes('serialize a bigint')) {
    return 'Billing is temporarily unavailable due to a backend data-format issue (BigInt serialization). Please ask backend to convert BigInt values to string in JSON responses.';
  }
  return fallback;
}

export function mapCodeToMessage(
  code: string | undefined,
  fallback?: string,
  details?: unknown
): string {
  const detailStr =
    details && typeof details === 'object' && !Array.isArray(details)
      ? Object.values(details as Record<string, unknown>)
          .flat()
          .filter((v) => typeof v === 'string')
          .join(', ')
      : '';

  const messages: Record<string, string> = {
    UNAUTHORIZED: fallback || 'Please sign in again.',
    FORBIDDEN: fallback || 'You do not have permission for this action.',
    VALIDATION_ERROR: detailStr || fallback || 'Please check your input.',
    RATE_LIMITED:
      fallback ||
      'Too many attempts. Please wait before trying again.',
    NOT_FOUND: fallback || 'The requested resource was not found.',
    INTERNAL_ERROR: fallback || 'Something went wrong on the server.',
    CONFIG_ERROR:
      fallback ||
      'Upload storage is not configured. Add a Vercel Blob store to this project and redeploy.',
  };
  if (code && messages[code]) return messages[code];
  return fallback || detailStr || 'An unexpected error occurred';
}

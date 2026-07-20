/** True when the API rejected the call due to missing permission (expected for gated features). */
export function isForbiddenError(error: unknown): boolean {
  const err = error as { response?: { status?: number; data?: { error?: { code?: string } } } };
  if (err?.response?.status === 403) return true;
  return err?.response?.data?.error?.code === 'FORBIDDEN';
}

/** True for auth failures on optional/gated requests (don't show as user-facing errors). */
export function isAuthDeniedError(error: unknown): boolean {
  const err = error as {
    response?: { status?: number; data?: { error?: { code?: string; message?: string } } };
  };
  const status = err?.response?.status;
  const code = err?.response?.data?.error?.code;
  const message = String(err?.response?.data?.error?.message || '');
  if (status === 403 || code === 'FORBIDDEN') return true;
  if (status === 401 || code === 'UNAUTHORIZED') return true;
  if (/no token provided/i.test(message)) return true;
  return false;
}

export const getErrorMessage = (error: any): string => {
  if (!error.response) {
    return 'Network error. Please check your connection.';
  }

  const status = error.response.status;
  const { code, message, details } = error.response.data?.error || {};
  const rawMessage = typeof message === 'string' ? message : '';

  if (status === 401) {
    if (/invalid|expired|unauthoriz/i.test(rawMessage) || /token/i.test(rawMessage)) {
      return 'Your session has expired or is no longer valid. Please sign in again.';
    }
    return 'Please sign in again to continue.';
  }

  if (status === 403) {
    return rawMessage || "You don't have permission to perform this action.";
  }

  // Map error codes to user-friendly messages
  const validationDetailMessage = (() => {
    if (!details) return '';
    if (Array.isArray(details)) {
      return details
        .map((d) => {
          if (d && typeof d === 'object' && 'message' in d) {
            const path = 'path' in d && d.path ? `${String(d.path)}: ` : '';
            return `${path}${String((d as { message: unknown }).message)}`;
          }
          return String(d);
        })
        .join(', ');
    }
    if (typeof details === 'object') {
      return Object.values(details).flat().join(', ');
    }
    return String(details);
  })();

  const errorMessages: Record<string, string> = {
    VALIDATION_ERROR: validationDetailMessage || 'Please check your input and try again',
    FEATURE_IN_USE: 'Unassign this feature from packages first.',
    UNAUTHORIZED: rawMessage
      ? /invalid|expired|token/i.test(rawMessage)
        ? 'Your session has expired or is no longer valid. Please sign in again.'
        : rawMessage
      : 'Please log in to continue',
    FORBIDDEN: 'You don\'t have permission to perform this action',
    NOT_FOUND: message || 'The requested item was not found',
    INTERNAL_ERROR: 'Something went wrong. Please try again later',
    RATE_LIMITED: message || 'Too many requests. Please wait and try again.',
  };

  return errorMessages[code] || message || 'An unexpected error occurred';
};


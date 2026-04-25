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

  // Map error codes to user-friendly messages
  const errorMessages: Record<string, string> = {
    VALIDATION_ERROR: details 
      ? Object.values(details).flat().join(', ')
      : 'Please check your input and try again',
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


export const getErrorMessage = (error: any): string => {
  if (!error.response) {
    return 'Network error. Please check your connection.';
  }

  const { code, message, details } = error.response.data?.error || {};

  // Map error codes to user-friendly messages
  const errorMessages: Record<string, string> = {
    VALIDATION_ERROR: details 
      ? Object.values(details).flat().join(', ')
      : 'Please check your input and try again',
    UNAUTHORIZED: message || 'Please log in to continue',
    FORBIDDEN: 'You don\'t have permission to perform this action',
    NOT_FOUND: message || 'The requested item was not found',
    INTERNAL_ERROR: 'Something went wrong. Please try again later',
  };

  return errorMessages[code] || message || 'An unexpected error occurred';
};


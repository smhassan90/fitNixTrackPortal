'use client';

import { useState, useCallback } from 'react';

interface AlertState {
  isOpen: boolean;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

export function useAlert() {
  const [alert, setAlert] = useState<AlertState>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
  });

  const showAlert = useCallback((
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string
  ) => {
    setAlert({
      isOpen: true,
      type,
      title,
      message,
    });
  }, []);

  const closeAlert = useCallback(() => {
    setAlert(prev => ({ ...prev, isOpen: false }));
  }, []);

  return {
    alert,
    showAlert,
    closeAlert,
  };
}


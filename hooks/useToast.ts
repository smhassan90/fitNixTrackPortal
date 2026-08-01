'use client';

import { useCallback, useState } from 'react';
import type { ToastType } from '@/components/Toast';

type ToastState = {
  isOpen: boolean;
  type: ToastType;
  message: string;
  title?: string;
};

export function useToast() {
  const [toast, setToast] = useState<ToastState>({
    isOpen: false,
    type: 'info',
    message: '',
  });

  const showToast = useCallback((type: ToastType, message: string, title?: string) => {
    setToast({ isOpen: true, type, message, title });
  }, []);

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return { toast, showToast, closeToast };
}

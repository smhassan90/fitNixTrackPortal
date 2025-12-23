'use client';

import { useEffect } from 'react';

interface AlertProps {
  isOpen: boolean;
  onClose: () => void;
  type?: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

export default function Alert({ 
  isOpen, 
  onClose, 
  type = 'info', 
  title, 
  message,
  duration = 3000 
}: AlertProps) {
  useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  const typeStyles = {
    success: {
      bg: 'bg-white',
      border: 'border-green-300',
      iconBg: 'bg-green-500',
      iconColor: 'text-white',
      titleColor: 'text-gray-900',
      messageColor: 'text-gray-700',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
    },
    error: {
      bg: 'bg-white',
      border: 'border-red-300',
      iconBg: 'bg-red-500',
      iconColor: 'text-white',
      titleColor: 'text-gray-900',
      messageColor: 'text-gray-700',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      ),
    },
    warning: {
      bg: 'bg-white',
      border: 'border-yellow-300',
      iconBg: 'bg-yellow-500',
      iconColor: 'text-white',
      titleColor: 'text-gray-900',
      messageColor: 'text-gray-700',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      ),
    },
    info: {
      bg: 'bg-white',
      border: 'border-blue-300',
      iconBg: 'bg-blue-500',
      iconColor: 'text-white',
      titleColor: 'text-gray-900',
      messageColor: 'text-gray-700',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      ),
    },
  };

  const styles = typeStyles[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      {/* Backdrop */}
      <div 
        className={`
          absolute inset-0 bg-black transition-opacity duration-300
          ${isOpen ? 'opacity-30' : 'opacity-0'}
          pointer-events-auto
        `}
        onClick={onClose}
      />
      {/* Alert Card */}
      <div 
        className={`
          ${styles.bg} ${styles.border} border-2 rounded-xl shadow-2xl p-6 max-w-md w-full relative z-10
          transform transition-all duration-300 ease-out
          ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 -translate-y-4'}
          pointer-events-auto
        `}
      >
        <div className="flex items-start">
          <div className={`${styles.iconBg} ${styles.iconColor} rounded-full p-2 flex-shrink-0`}>
            {styles.icon}
          </div>
          <div className="ml-4 flex-1">
            <h3 className={`${styles.titleColor} font-bold text-lg mb-1`}>
              {title}
            </h3>
            <p className={`${styles.messageColor} text-sm`}>
              {message}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}


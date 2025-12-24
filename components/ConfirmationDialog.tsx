'use client';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
}

export default function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  const typeStyles = {
    warning: {
      iconBg: 'bg-yellow-500',
      iconColor: 'text-white',
      confirmBg: 'bg-green-600 hover:bg-green-700',
    },
    danger: {
      iconBg: 'bg-red-500',
      iconColor: 'text-white',
      confirmBg: 'bg-red-600 hover:bg-red-700',
    },
    info: {
      iconBg: 'bg-blue-500',
      iconColor: 'text-white',
      confirmBg: 'bg-blue-600 hover:bg-blue-700',
    },
  };

  const styles = typeStyles[type];

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black transition-opacity duration-300 opacity-30 pointer-events-auto"
        onClick={onClose}
      />
      
      {/* Dialog Card */}
      <div
        className="bg-white border-2 border-gray-200 rounded-xl shadow-2xl p-6 max-w-md w-full relative z-10 transform transition-all duration-300 ease-out scale-100 opacity-100 translate-y-0 pointer-events-auto"
      >
        <div className="flex items-start mb-4">
          <div className={`${styles.iconBg} ${styles.iconColor} rounded-full p-3 flex-shrink-0`}>
            {type === 'warning' && (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            {type === 'danger' && (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            {type === 'info' && (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="ml-4 flex-1">
            <h3 className="text-gray-900 font-bold text-lg mb-2">
              {title}
            </h3>
            <p className="text-gray-700 text-sm">
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
        
        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 text-gray-800 py-2.5 px-4 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 ${styles.confirmBg} py-2.5 px-4 rounded-lg transition-colors font-medium shadow-sm text-white`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}


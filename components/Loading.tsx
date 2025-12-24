'use client';

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
  inline?: boolean;
}

export default function Loading({ 
  message = 'Loading...', 
  fullScreen = false,
  size = 'md',
  inline = false
}: LoadingProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-16 h-16 border-4',
    lg: 'w-24 h-24 border-4'
  };

  const spinnerSize = sizeClasses[size];

  // Inline loading (for buttons)
  if (inline) {
    return (
      <div className="flex items-center gap-2">
        <div className={`${spinnerSize} border-primary/20 border-t-primary rounded-full animate-spin`}></div>
        {message && <span className="text-sm">{message}</span>}
      </div>
    );
  }

  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      {/* Animated Spinner */}
      <div className="relative">
        {/* Outer rotating ring */}
        <div className={`${spinnerSize} border-primary/20 border-t-primary rounded-full animate-spin`}></div>
        {/* Inner pulsing dot */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full animate-pulse"></div>
      </div>
      
      {/* Loading text with animation */}
      {message && (
        <div className="flex items-center gap-2">
          <span className="text-gray-700 font-medium text-lg">{message}</span>
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-95 backdrop-blur-sm z-50 flex items-center justify-center">
        {content}
      </div>
    );
  }

  return (
    <div className="py-12 flex items-center justify-center">
      {content}
    </div>
  );
}


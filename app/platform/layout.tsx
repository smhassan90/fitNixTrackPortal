import type { Metadata } from 'next';
import { PlatformAuthProvider } from '@/contexts/PlatformAuthContext';

export const metadata: Metadata = {
  title: 'FitNix Platform',
  description: 'FitNix platform operator console',
};

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformAuthProvider>
      <div className="min-h-screen bg-canvas text-dark-gray">{children}</div>
    </PlatformAuthProvider>
  );
}

import PlatformProtectedShell from '@/components/platform/PlatformProtectedShell';

export default function PlatformProtectedLayout({ children }: { children: React.ReactNode }) {
  return <PlatformProtectedShell>{children}</PlatformProtectedShell>;
}

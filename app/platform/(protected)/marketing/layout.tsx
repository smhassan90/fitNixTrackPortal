'use client';

import MarketingSuperAdminGate from '@/components/platform/marketing/MarketingSuperAdminGate';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <MarketingSuperAdminGate>{children}</MarketingSuperAdminGate>;
}

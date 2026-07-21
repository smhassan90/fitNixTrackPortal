'use client';

import Layout from '@/components/Layout';
import PosSubNav from '@/components/pos/PosSubNav';

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <Layout>
      <div className="mx-auto max-w-7xl">
        <PosSubNav />
        {children}
      </div>
    </Layout>
  );
}

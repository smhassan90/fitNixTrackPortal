'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { firstPosPath, hasAnyPosPermission } from '@/lib/pos/permissions';
import Loading from '@/components/Loading';

export default function PosIndexPage() {
  const { loading, can } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!hasAnyPosPermission(can)) {
      router.replace('/attendance');
      return;
    }
    router.replace(firstPosPath(can));
  }, [loading, can, router]);

  return <Loading message="Loading POS…" />;
}

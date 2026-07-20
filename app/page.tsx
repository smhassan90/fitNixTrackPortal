'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { firstAllowedGymPath } from '@/lib/gymRouteAccess';
import { isGymAdmin } from '@/lib/gymRoles';
import Loading from '@/components/Loading';

export default function Home() {
  const { user, loading, can } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    router.replace(firstAllowedGymPath(can, isGymAdmin(user.role)));
  }, [loading, user, can, router]);

  return <Loading message="Loading…" fullScreen size="lg" />;
}

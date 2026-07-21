'use client';

import type { ReactNode } from 'react';

export default function PosPermissionGate({
  allowed,
  message = "You don't have permission to view this section.",
  children,
}: {
  allowed: boolean;
  message?: string;
  children: ReactNode;
}) {
  if (!allowed) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-8 text-center">
        <p className="text-sm font-semibold text-amber-900">Permission required</p>
        <p className="mt-2 text-sm text-amber-800">{message}</p>
      </div>
    );
  }
  return <>{children}</>;
}

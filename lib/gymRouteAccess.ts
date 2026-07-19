/**
 * Maps gym portal routes to the permission required to open them.
 * Attendance is always allowed for any logged-in gym user.
 * Import (if present) is admin-only via role, not a permission key.
 */

export type RouteAccessRule = {
  /** Path prefix match (longest match wins). */
  prefix: string;
  /** Required permission key; omit for always-allowed (attendance). */
  permission?: string;
  /** Only GYM_ADMIN may open (e.g. import). */
  adminOnly?: boolean;
};

/** Ordered longest-prefix-first for matching. */
export const GYM_ROUTE_ACCESS: RouteAccessRule[] = [
  { prefix: '/packages/features', permission: 'gym.packageFeatures.manage' },
  { prefix: '/payments/members', permission: 'gym.payments.read' },
  { prefix: '/import', adminOnly: true },
  { prefix: '/dashboard', permission: 'gym.dashboard.read' },
  { prefix: '/members', permission: 'gym.members.read' },
  { prefix: '/trainers', permission: 'gym.trainers.read' },
  { prefix: '/packages', permission: 'gym.packages.read' },
  { prefix: '/attendance', /* always */ },
  { prefix: '/payments', permission: 'gym.payments.read' },
  { prefix: '/reports', permission: 'gym.financialReports.read' },
  { prefix: '/settings', permission: 'gym.settings.read' },
  { prefix: '/team', permission: 'gym.team.manage' },
];

export function matchRouteAccess(pathname: string): RouteAccessRule | null {
  const path = pathname.split('?')[0] || '/';
  for (const rule of GYM_ROUTE_ACCESS) {
    if (path === rule.prefix || path.startsWith(`${rule.prefix}/`)) {
      return rule;
    }
  }
  return null;
}

/** Safe fallback when a user lacks permission for the current route. */
export function firstAllowedGymPath(
  can: (key: string) => boolean,
  isAdmin: boolean
): string {
  // Attendance is always available to logged-in gym users.
  if (can('gym.dashboard.read')) return '/dashboard';
  if (can('gym.members.read')) return '/members';
  if (can('gym.payments.read')) return '/payments';
  if (can('gym.trainers.read')) return '/trainers';
  if (can('gym.packages.read')) return '/packages';
  if (can('gym.financialReports.read')) return '/reports';
  if (can('gym.settings.read')) return '/settings';
  if (can('gym.team.manage')) return '/team';
  if (isAdmin) return '/dashboard';
  return '/attendance';
}

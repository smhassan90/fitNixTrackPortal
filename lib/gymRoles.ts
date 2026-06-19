/** Gym roles that may manage day-to-day gym data (members, packages, trainers, payments). */
const GYM_MANAGER_ROLES = new Set(['GYM_ADMIN', 'GYM_MANAGER']);

export function normalizeGymRole(role?: string | null): string {
  return String(role ?? '')
    .trim()
    .toUpperCase();
}

export function canManageGymPayments(role?: string | null): boolean {
  return GYM_MANAGER_ROLES.has(normalizeGymRole(role));
}

/** Add, update, delete members, packages, and trainers. */
export function canManageGymCatalog(role?: string | null): boolean {
  return GYM_MANAGER_ROLES.has(normalizeGymRole(role));
}

export function isGymAdmin(role?: string | null): boolean {
  return normalizeGymRole(role) === 'GYM_ADMIN';
}

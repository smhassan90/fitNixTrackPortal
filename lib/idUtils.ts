/**
 * Generate a unique ID using UUID v4
 * This ensures uniqueness across all gyms and deployments
 */
export function generateUniqueId(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    // Use browser's built-in crypto.randomUUID() if available
    return window.crypto.randomUUID();
  }
  
  // Fallback for older browsers or server-side
  // Generate a UUID v4 manually
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Generate a unique ID with optional prefix
 * Useful for creating IDs like "member-{uuid}" or "payment-{uuid}"
 */
export function generatePrefixedId(prefix?: string): string {
  const uuid = generateUniqueId();
  return prefix ? `${prefix}-${uuid}` : uuid;
}

/**
 * Generate a gym-scoped unique ID
 * Format: {entityType}-{gymId}-{uuid}
 * 
 * This ensures:
 * - Global uniqueness (UUID)
 * - Gym context (gymId)
 * - Entity type identification (prefix)
 * 
 * Example: "member-gym-1-550e8400-e29b-41d4-a716-446655440000"
 * 
 * @param entityType - Type of entity (member, trainer, package, payment, etc.)
 * @param gymId - Gym identifier from user context
 * @returns Gym-scoped unique ID
 */
export function generateGymScopedId(entityType: string, gymId: string): string {
  const uuid = generateUniqueId();
  return `${entityType}-${gymId}-${uuid}`;
}

/**
 * Extract gym ID from a gym-scoped ID
 * @param gymScopedId - ID in format "{entityType}-{gymId}-{uuid}"
 * @returns Gym ID or null if format is invalid
 */
export function extractGymIdFromId(gymScopedId: string): string | null {
  const parts = gymScopedId.split('-');
  // Format: {entityType}-{gymId}-{uuid}
  // UUID has 5 parts, so we need at least 6 parts total
  if (parts.length < 6) return null;
  
  // gymId is the second part (index 1)
  return parts[1] || null;
}


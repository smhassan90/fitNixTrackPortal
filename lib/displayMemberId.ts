/**
 * Gym-facing member numbers vs internal primary keys.
 *
 * - `id` = internal PK — API routes, React keys, request bodies only
 * - `memberNumber` / `legacyMemberId` = what staff see as "Member ID"
 */

export type MemberNumberFields = {
  memberNumber?: string | number | null;
  legacyMemberId?: string | number | null;
};

/** Display value for every “Member ID” / “ID” label in the UI. Never falls back to PK. */
export function displayMemberId(m?: MemberNumberFields | null): string {
  if (m == null) return '—';
  const n = m.memberNumber ?? m.legacyMemberId;
  if (n == null || n === '') return '—';
  return String(n);
}

/** Pull gym-facing number from a raw API member (or flat row) object. */
export function pickMemberNumber(raw?: Record<string, unknown> | null): string | number | null {
  if (!raw) return null;
  const n = raw.memberNumber ?? raw.legacyMemberId;
  if (n == null || n === '') return null;
  return n as string | number;
}

/** Normalize memberNumber + legacyMemberId from API payloads (kept in sync when both present). */
export function normalizeMemberNumberFields(
  raw?: Record<string, unknown> | null
): { memberNumber: string | null; legacyMemberId: string | null } {
  const picked = pickMemberNumber(raw);
  const asStr = picked != null ? String(picked) : null;
  return {
    memberNumber: asStr,
    legacyMemberId: asStr,
  };
}

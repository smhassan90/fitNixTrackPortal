/**
 * Member sublines for report KPIs. Prefers API *MemberCount when present.
 * Optional fallback uses open-member-summaries bucket counts (same basis as
 * client-side rupee totals when the server omits counts).
 */

export type ReportsMemberSubline = { kind: 'none' } | { kind: 'count'; n: number };

export function reportsMemberSubline(opts: {
  displayAmount: number;
  amountFromApi: boolean;
  apiMemberCount: number | undefined;
  clientMemberCount: number;
  /** If the API sends the amount but not *MemberCount, use client bucket member count (overdue/pending/advance). */
  fallbackClientWhenApiCountMissing?: boolean;
}): ReportsMemberSubline {
  const {
    displayAmount,
    amountFromApi,
    apiMemberCount,
    clientMemberCount,
    fallbackClientWhenApiCountMissing,
  } = opts;
  if (displayAmount <= 0) return { kind: 'none' };

  if (!amountFromApi) {
    return clientMemberCount > 0 ? { kind: 'count', n: clientMemberCount } : { kind: 'none' };
  }

  let n = apiMemberCount;
  if (n === undefined && fallbackClientWhenApiCountMissing) {
    n = clientMemberCount;
  }

  if (n !== undefined && n > 0) return { kind: 'count', n };
  return { kind: 'none' };
}

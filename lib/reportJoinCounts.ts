import type { AxiosInstance } from 'axios';

export function countCreatedInRange(
  records: Record<string, unknown>[],
  start: string,
  end: string
): { count: number; anyTimestamp: boolean } {
  let count = 0;
  let anyTimestamp = false;
  const t0 = new Date(`${start}T00:00:00`).getTime();
  const t1 = new Date(`${end}T23:59:59.999`).getTime();
  for (const x of records) {
    const c = x.createdAt ?? x.joinedAt ?? x.memberSince ?? x.registrationDate ?? x.created_at;
    if (c == null || c === '') continue;
    anyTimestamp = true;
    const t = new Date(String(c)).getTime();
    if (!Number.isNaN(t) && t >= t0 && t <= t1) count += 1;
  }
  return { count, anyTimestamp };
}

async function tryFilteredMembersCount(
  client: AxiosInstance,
  start: string,
  end: string
): Promise<{ count: number; usedServerFilter: boolean } | null> {
  const params = new URLSearchParams({
    createdFrom: start,
    createdTo: end,
    limit: '500',
  });
  try {
    const res = await client.get(`/api/members?${params}`);
    if (!res.data?.success) return null;
    const data = res.data.data || {};
    const list = (data.members ?? []) as Record<string, unknown>[];
    const p = data.pagination as Record<string, unknown> | undefined;
    const total = p?.total != null ? Number(p.total) : NaN;
    const count = !Number.isNaN(total) ? total : list.length;
    return { count, usedServerFilter: true };
  } catch {
    return null;
  }
}

/**
 * Prefer GET /api/members?createdFrom&createdTo (gym TZ on server).
 * Falls back to listing up to 1000 and counting createdAt client-side.
 */
export async function fetchJoinCountsForRange(
  client: AxiosInstance,
  start: string,
  end: string
): Promise<{
  members: { count: number; known: boolean; usedServerFilter: boolean };
}> {
  const mFiltered = await tryFilteredMembersCount(client, start, end);
  let mCount = mFiltered?.count ?? 0;
  let mKnown = mFiltered != null;
  let mServer = mFiltered?.usedServerFilter ?? false;
  if (mFiltered == null) {
    try {
      const res = await client.get('/api/members?limit=1000');
      if (res.data?.success) {
        const list = (res.data.data?.members ?? []) as Record<string, unknown>[];
        const r = countCreatedInRange(list, start, end);
        mCount = r.count;
        mKnown = r.anyTimestamp;
        mServer = false;
      }
    } catch {
      /* keep defaults */
    }
  }

  return {
    members: { count: mCount, known: mKnown, usedServerFilter: mServer },
  };
}

import api from '@/lib/api';

/** Paginates `GET /api/payments/member-summaries` until exhausted (safety cap). */
export async function fetchAllMemberSummaries(options: { onlyOpen: boolean }): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let page = 1; page <= 40; page++) {
    const p = new URLSearchParams({
      page: String(page),
      limit: '200',
      sortBy: 'name',
      sortOrder: 'asc',
    });
    if (options.onlyOpen) p.set('onlyWithOpenInstallments', 'true');
    try {
      const res = await api.get(`/api/payments/member-summaries?${p}`);
      if (!res.data?.success) break;
      const data = res.data.data || {};
      const list = (data.members ?? data.memberSummaries ?? data.summaries ?? []) as Record<string, unknown>[];
      out.push(...list);
      const totalPages = Number(data.pagination?.totalPages) || 1;
      if (page >= totalPages || list.length === 0) break;
    } catch {
      break;
    }
  }
  return out;
}

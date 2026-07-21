/** User-facing labels and light formatting for platform UI (avoid exposing raw API jargon). */

const METRIC_LABELS: Record<string, string> = {
  totalCollectedInRange: 'Money collected (period)',
  totalMembers: 'Total members',
  totalTrainers: 'Total trainers',
  totalGyms: 'Total gyms',
  newGyms: 'New gyms',
  activeGyms: 'Active gyms',
  suspendedGyms: 'Paused gyms',
};

export function friendlyMetricLabel(key: string): string {
  if (METRIC_LABELS[key]) return METRIC_LABELS[key];
  const spaced = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1');
  const t = spaced.trim();
  if (!t) return key;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function formatMetricValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}

export function humanizePlatformRole(role: string): string {
  if (role === 'SUPER_ADMIN') return 'Super admin';
  if (role === 'PLATFORM_SUPPORT') return 'Support';
  return role.replace(/_/g, ' ');
}

/** One-line summary for generic billing / dues list rows */
export function describeBillingRow(row: unknown): { title: string; subtitle: string } {
  if (!row || typeof row !== 'object') {
    return { title: 'Entry', subtitle: String(row) };
  }
  const o = row as Record<string, unknown>;
  const title = String(
    o.gymName ?? o.tenantName ?? o.name ?? o.slug ?? o.organizationName ?? 'Subscription'
  );
  const bits: string[] = [];
  if (o.planName) bits.push(String(o.planName));
  if (o.subscriptionStatus ?? o.status) bits.push(String(o.subscriptionStatus ?? o.status));
  const dueDate = normalizeDateLike(o.dueDate);
  if (dueDate) bits.push(`Due ${dueDate}`);
  if (o.overdueAmount != null && o.overdueAmount !== '') bits.push(`Overdue: ${String(o.overdueAmount)}`);
  if (o.pendingAmount != null && o.pendingAmount !== '') bits.push(`Outstanding: ${String(o.pendingAmount)}`);
  if (bits.length === 0) bits.push('Details will appear here once your billing feed includes them.');
  return { title, subtitle: bits.join(' · ') };
}

function firstDefinedValue(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = obj[key];
    if (value != null && String(value).trim() !== '') return value;
  }
  return null;
}

export function billingCollectedAmount(row: unknown): string {
  if (!row || typeof row !== 'object') return '—';
  const obj = row as Record<string, unknown>;
  const value = firstDefinedValue(obj, [
    'amountCollected',
    'collectedAmount',
    'totalCollected',
    'paidAmount',
    'receivedAmount',
  ]);
  if (value == null) return '—';
  return String(value);
}

function normalizeDateLike(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (typeof value === 'number') return new Date(value).toISOString().slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const nested =
      o.iso ??
      o.value ??
      o.date ??
      o.paidAt ??
      o.lastPaidAt ??
      o.dueDate ??
      o.$date ??
      o.toString;
    if (typeof nested === 'string') return nested.slice(0, 10);
  }
  return '';
}

export function billingHistorySummary(row: unknown): string {
  if (!row || typeof row !== 'object') return '—';
  const obj = row as Record<string, unknown>;
  const lastPaidAt = firstDefinedValue(obj, ['lastPaidAt', 'paidAt', 'markPaidAt', 'lastPaymentDate']);
  const packageName = firstDefinedValue(obj, ['planName', 'packageName', 'subscriptionPlanName']);
  const notes = firstDefinedValue(obj, ['notes', 'billingNotes']);
  const historyList = firstDefinedValue(obj, ['history', 'paymentHistory', 'payments']);

  const parts: string[] = [];
  const paidDate = normalizeDateLike(lastPaidAt);
  if (paidDate) parts.push(`Last paid: ${paidDate}`);
  if (packageName != null) parts.push(`Package: ${String(packageName)}`);
  if (Array.isArray(historyList)) parts.push(`${historyList.length} payment entries`);
  if (notes != null) parts.push(String(notes));
  return parts.length > 0 ? parts.join(' · ') : '—';
}

/** Table-oriented audit row (backend field names may vary) */
export function describeAuditRow(row: unknown): { when: string; action: string; detail: string } {
  if (!row || typeof row !== 'object') {
    return { when: '—', action: '—', detail: String(row) };
  }
  const o = row as Record<string, unknown>;
  const rawWhen = o.createdAt ?? o.timestamp ?? o.at ?? o.occurredAt;
  const when = rawWhen != null ? String(rawWhen).slice(0, 19).replace('T', ' ') : '—';
  const action = String(o.actionType ?? o.action ?? o.type ?? '—');
  const who = o.actorName ?? o.actorEmail ?? o.userEmail ?? o.performedBy;
  const target = o.targetGymName ?? o.gymName ?? o.targetName ?? o.targetGymId ?? o.targetId;
  const msg = o.message ?? o.description ?? o.summary;
  const parts = [
    who ? `By ${String(who)}` : '',
    target ? `Target: ${String(target)}` : '',
    msg ? String(msg) : '',
  ].filter(Boolean);
  return { when, action, detail: parts.join(' · ') || '—' };
}

/** Top gyms report row (backend nests gym under `gym`) */
export function describeTopGymRow(row: unknown): {
  name: string;
  membersCount: number | null;
  gymId: string | number | null;
} {
  if (!row || typeof row !== 'object') {
    return { name: 'Gym', membersCount: null, gymId: null };
  }
  const o = row as Record<string, unknown>;
  const nested = o.gym ?? o.tenant;
  let name = '';
  if (nested && typeof nested === 'object') {
    const g = nested as Record<string, unknown>;
    const nestedName = firstDefinedValue(g, ['name', 'gymName', 'tenantName']);
    if (nestedName != null) name = String(nestedName).trim();
  }
  if (!name) {
    const flatName = firstDefinedValue(o, ['gymName', 'tenantName', 'name', 'organizationName', 'slug']);
    if (flatName != null) name = String(flatName).trim();
  }

  const countRaw = firstDefinedValue(o, [
    'membersCount',
    'activeMemberCount',
    'activeMembersCount',
    'memberCount',
  ]);
  const membersCount =
    countRaw != null && !Number.isNaN(Number(countRaw)) ? Number(countRaw) : null;

  const gymId =
    (nested && typeof nested === 'object'
      ? (nested as Record<string, unknown>).id
      : null) ??
    o.gymId ??
    o.id ??
    null;

  return { name: name || 'Gym', membersCount, gymId: gymId as string | number | null };
}

/** Ordered “gym profile” fields for the overview tab */
export function gymProfileSummary(gym: Record<string, unknown>): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  const add = (label: string, key: string) => {
    const v = gym[key];
    if (v != null && String(v).trim() !== '') rows.push({ label, value: String(v) });
  };

  add('Gym name', 'name');
  add('Address line', 'address');
  add('City', 'city');
  add('Country', 'country');
  add('Timezone', 'timezone');
  add('Phone', 'phone');
  add('Email', 'email');
  add('Web address key', 'slug');

  const status = gym.tenantStatus ?? gym.status;
  if (status != null && String(status).trim() !== '') {
    rows.push({ label: 'Account status', value: String(status) });
  }

  const sub = gym.subscription;
  if (sub && typeof sub === 'object') {
    const s = sub as Record<string, unknown>;
    if (s.planName) rows.push({ label: 'Current plan', value: String(s.planName) });
    if (s.dueDate) rows.push({ label: 'Next payment', value: String(s.dueDate).slice(0, 10) });
    if (s.subscriptionStatus) rows.push({ label: 'Subscription status', value: String(s.subscriptionStatus) });
  }

  const counts: string[] = [];
  if (gym.membersCount != null) counts.push(`${String(gym.membersCount)} members`);
  if (gym.trainersCount != null) counts.push(`${String(gym.trainersCount)} trainers`);
  if (counts.length) rows.push({ label: 'Size', value: counts.join(' · ') });

  if (gym.pendingAmount != null && String(gym.pendingAmount) !== '') {
    rows.push({ label: 'Outstanding balance', value: String(gym.pendingAmount) });
  }
  if (gym.overdueAmount != null && String(gym.overdueAmount) !== '') {
    rows.push({ label: 'Overdue balance', value: String(gym.overdueAmount) });
  }

  return rows;
}

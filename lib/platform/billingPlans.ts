export type BillingPlanOption = {
  id: string;
  label: string;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function toPlanOption(entry: unknown): BillingPlanOption | null {
  const obj = asObject(entry);
  if (!obj) return null;
  const id = asString(obj.id ?? obj.planId ?? obj.billingPlanId ?? obj.plan_id);
  if (!id) return null;
  const name = asString(obj.name ?? obj.planName ?? obj.code);
  const code = asString(obj.code);
  const price = asString(obj.price ?? obj.amount);
  const pieces = [name, code ? `(${code})` : '', price ? `- ${price}` : ''].filter(Boolean);
  const label = pieces.join(' ') || `Plan ${id}`;
  return { id, label };
}

export function normalizeBillingPlans(payload: unknown): BillingPlanOption[] {
  const root = asObject(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.plans)
      ? root.plans
      : Array.isArray(root?.items)
        ? root.items
        : [];

  const dedup = new Map<string, BillingPlanOption>();
  list.forEach((entry) => {
    const p = toPlanOption(entry);
    if (p) dedup.set(p.id, p);
  });
  return Array.from(dedup.values());
}

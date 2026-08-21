import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errorHandler';

export type ExpenseKind = 'FIXED' | 'PETTY' | 'OTHER';
export type ExpensePaymentMethod = 'CASH' | 'ONLINE' | 'OTHER';

export type ExpenseCategory = {
  id: number;
  gymId: number;
  name: string;
  kind: ExpenseKind;
  isRecurring: boolean;
  defaultAmount: number | null;
  isActive: boolean;
  sortOrder: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseEntry = {
  id: number;
  gymId: number;
  categoryId: number;
  amount: number;
  spentAt: string;
  paymentMethod: ExpensePaymentMethod | null;
  notes: string | null;
  createdById: number;
  updatedById: number | null;
  createdAt: string;
  updatedAt: string;
  category: { id: number; name: string; kind: ExpenseKind; isActive: boolean };
  createdBy: { id: number; name: string };
  updatedBy: { id: number; name: string } | null;
};

export type ExpensePagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ExpenseCategoryPayload = {
  name?: string;
  kind?: ExpenseKind;
  isRecurring?: boolean;
  defaultAmount?: number | null;
  sortOrder?: number;
  isActive?: boolean;
};

export type ExpenseEntryPayload = {
  categoryId?: number;
  amount?: number;
  spentAt?: string;
  paymentMethod?: ExpensePaymentMethod | null;
  notes?: string | null;
};

export type PnlSummary = {
  gymId: number;
  month: string;
  currency: string;
  incomeSoFar: number;
  membershipIncomeSoFar: number;
  posSalesSoFar: number;
  expensesSoFar: number;
  netSoFar: number;
  byKind: { FIXED: number; PETTY: number; OTHER: number };
  byCategory: Array<{
    categoryId: number;
    name: string;
    kind: ExpenseKind;
    amount: number;
  }>;
  remainingRecurring: number;
  paceProjection: {
    projectedIncome: number;
    projectedExpenses: number;
    projectedNet: number;
    dayOfMonth: number;
    daysInMonth: number;
  };
  duesProjection: {
    expectedRemaining: number;
    projectedIncome: number;
    projectedExpenses: number;
    projectedNet: number;
  };
  dailyIncome: Array<{
    date: string;
    amount: number;
    paymentCount: number;
    memberCount: number;
  }>;
  productsSummary: {
    soldAmount: number;
    soldQuantity: number;
    items: Array<{
      productId: number;
      name: string;
      stockQuantity: number;
      soldQuantity: number;
      soldAmount: number;
    }>;
  };
  summary: {
    totalSales: number;
    fixed: number;
    petty: number;
    other: number;
    totalExpense: number;
    netIncome: number;
  };
};

const KINDS = new Set<ExpenseKind>(['FIXED', 'PETTY', 'OTHER']);
const METHODS = new Set<ExpensePaymentMethod>(['CASH', 'ONLINE', 'OTHER']);

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function pickStr(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function unwrapData(body: unknown): unknown {
  const root = asObj(body);
  if (!root) return body;
  if (root.success === false) {
    const err = asObj(root.error);
    throw Object.assign(new Error(pickStr(err?.message) || 'Request failed'), {
      response: { data: root },
    });
  }
  return root.data ?? body;
}

function asKind(v: unknown, fallback: ExpenseKind = 'PETTY'): ExpenseKind {
  const k = pickStr(v).toUpperCase();
  return KINDS.has(k as ExpenseKind) ? (k as ExpenseKind) : fallback;
}

function asMethod(v: unknown): ExpensePaymentMethod | null {
  const k = pickStr(v).toUpperCase();
  return METHODS.has(k as ExpensePaymentMethod) ? (k as ExpensePaymentMethod) : null;
}

function dayOnly(v: unknown): string {
  const s = pickStr(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

export function formatExpenseMoney(amount: number, currency = 'PKR'): string {
  const n = Number(amount) || 0;
  const prefix = !currency || String(currency).toUpperCase() === 'PKR' ? 'Rs. ' : `${currency} `;
  return `${prefix}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function expenseKindLabel(kind: ExpenseKind | string | null | undefined): string {
  switch (String(kind || '').toUpperCase()) {
    case 'FIXED':
      return 'Fixed';
    case 'PETTY':
      return 'Petty';
    case 'OTHER':
      return 'Other';
    default:
      return '—';
  }
}

export function expenseMethodLabel(method: ExpensePaymentMethod | string | null | undefined): string {
  switch (String(method || '').toUpperCase()) {
    case 'CASH':
      return 'Cash';
    case 'ONLINE':
      return 'Online';
    case 'OTHER':
      return 'Other';
    default:
      return '—';
  }
}

export function currentExpenseMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthDateRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split('-').map((x) => parseInt(x, 10));
  if (!y || !m) {
    const fallback = currentExpenseMonth();
    return monthDateRange(fallback);
  }
  const last = new Date(y, m, 0).getDate();
  return {
    from: `${ym}-01`,
    to: `${ym}-${String(last).padStart(2, '0')}`,
  };
}

export function expenseErrorMessage(err: unknown): string {
  const axiosErr = err as {
    response?: { status?: number; data?: { error?: { code?: string; message?: string } } };
  };
  const status = axiosErr.response?.status;
  const code = axiosErr.response?.data?.error?.code;
  const raw = axiosErr.response?.data?.error?.message;
  if (status === 409 || code === 'CONFLICT') {
    return raw || 'An expense head with this name already exists.';
  }
  if (status === 403 || code === 'FORBIDDEN') {
    return raw || "You don't have permission to perform this action.";
  }
  return getErrorMessage(err as object);
}

function normalizePerson(row: unknown): { id: number; name: string } | null {
  const o = asObj(row);
  if (!o) return null;
  const id = num(o.id);
  if (!id) return null;
  return { id, name: pickStr(o.name) || '—' };
}

function normalizeCategoryLite(row: unknown, fallbackId = 0): ExpenseEntry['category'] {
  const o = asObj(row);
  if (!o) {
    return { id: fallbackId, name: '—', kind: 'OTHER', isActive: true };
  }
  return {
    id: num(o.id, fallbackId),
    name: pickStr(o.name) || '—',
    kind: asKind(o.kind),
    isActive: o.isActive !== false,
  };
}

export function normalizeExpenseCategory(row: unknown): ExpenseCategory | null {
  const o = asObj(row);
  if (!o) return null;
  const id = num(o.id);
  if (!id) return null;
  const defaultRaw = o.defaultAmount;
  return {
    id,
    gymId: num(o.gymId),
    name: pickStr(o.name) || '—',
    kind: asKind(o.kind),
    isRecurring: o.isRecurring === true,
    defaultAmount: defaultRaw == null || defaultRaw === '' ? null : num(defaultRaw),
    isActive: o.isActive !== false && o.deletedAt == null,
    sortOrder: num(o.sortOrder),
    deletedAt: pickStr(o.deletedAt) || null,
    createdAt: pickStr(o.createdAt),
    updatedAt: pickStr(o.updatedAt),
  };
}

export function normalizeExpenseEntry(row: unknown): ExpenseEntry | null {
  const o = asObj(row);
  if (!o) return null;
  const id = num(o.id);
  if (!id) return null;
  const categoryId = num(o.categoryId);
  const createdBy = normalizePerson(o.createdBy) ?? { id: num(o.createdById), name: '—' };
  const updatedBy = normalizePerson(o.updatedBy);
  return {
    id,
    gymId: num(o.gymId),
    categoryId,
    amount: num(o.amount),
    spentAt: dayOnly(o.spentAt),
    paymentMethod: asMethod(o.paymentMethod),
    notes: pickStr(o.notes) || null,
    createdById: createdBy.id,
    updatedById: updatedBy?.id ?? (o.updatedById != null ? num(o.updatedById) : null),
    createdAt: pickStr(o.createdAt),
    updatedAt: pickStr(o.updatedAt),
    category: normalizeCategoryLite(o.category, categoryId),
    createdBy,
    updatedBy,
  };
}

function normalizePagination(raw: unknown, page: number, limit: number): ExpensePagination {
  const o = asObj(raw);
  const p = asObj(o?.pagination) ?? o;
  const totalPages = Math.max(1, num(p?.totalPages, 1));
  return {
    page: num(p?.page, page),
    limit: num(p?.limit, limit),
    total: num(p?.total),
    totalPages,
  };
}

export async function fetchExpenseCategories(includeInactive = false): Promise<ExpenseCategory[]> {
  const res = await api.get('/api/expenses/categories', {
    params: includeInactive ? { includeInactive: true } : undefined,
  });
  const data = unwrapData(res.data);
  const obj = asObj(data);
  const list = Array.isArray(data)
    ? data
    : Array.isArray(obj?.categories)
      ? obj!.categories
      : [];
  return list
    .map((row) => normalizeExpenseCategory(row))
    .filter((c): c is ExpenseCategory => c != null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export async function createExpenseCategory(payload: ExpenseCategoryPayload): Promise<ExpenseCategory> {
  const res = await api.post('/api/expenses/categories', payload);
  const created = normalizeExpenseCategory(unwrapData(res.data));
  if (!created) throw new Error('Failed to create expense head');
  return created;
}

export async function updateExpenseCategory(
  id: number,
  payload: ExpenseCategoryPayload
): Promise<ExpenseCategory> {
  const res = await api.patch(`/api/expenses/categories/${id}`, payload);
  const updated = normalizeExpenseCategory(unwrapData(res.data));
  if (!updated) throw new Error('Failed to update expense head');
  return updated;
}

export async function deleteExpenseCategory(id: number): Promise<void> {
  await api.delete(`/api/expenses/categories/${id}`);
}

export async function fetchExpenseEntries(params: {
  from?: string;
  to?: string;
  categoryId?: number;
  kind?: ExpenseKind;
  page?: number;
  limit?: number;
}): Promise<{ entries: ExpenseEntry[]; pagination: ExpensePagination }> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  const res = await api.get('/api/expenses', {
    params: {
      from: params.from || undefined,
      to: params.to || undefined,
      categoryId: params.categoryId || undefined,
      kind: params.kind || undefined,
      page,
      limit,
    },
  });
  const data = unwrapData(res.data);
  const obj = asObj(data);
  const list = Array.isArray(obj?.entries) ? obj!.entries : Array.isArray(data) ? data : [];
  return {
    entries: list
      .map((row) => normalizeExpenseEntry(row))
      .filter((e): e is ExpenseEntry => e != null),
    pagination: normalizePagination(obj, page, limit),
  };
}

export async function createExpenseEntry(payload: ExpenseEntryPayload): Promise<ExpenseEntry> {
  const res = await api.post('/api/expenses', payload);
  const created = normalizeExpenseEntry(unwrapData(res.data));
  if (!created) throw new Error('Failed to create expense');
  return created;
}

export async function updateExpenseEntry(
  id: number,
  payload: ExpenseEntryPayload
): Promise<ExpenseEntry> {
  const res = await api.patch(`/api/expenses/${id}`, payload);
  const updated = normalizeExpenseEntry(unwrapData(res.data));
  if (!updated) throw new Error('Failed to update expense');
  return updated;
}

export async function deleteExpenseEntry(id: number): Promise<{ id: number }> {
  const res = await api.delete(`/api/expenses/${id}`);
  const data = asObj(unwrapData(res.data));
  return { id: num(data?.id, id) };
}

function normalizePnl(row: unknown, fallbackMonth: string): PnlSummary {
  const o = asObj(row) ?? {};
  const byKindObj = asObj(o.byKind);
  const pace = asObj(o.paceProjection);
  const dues = asObj(o.duesProjection);
  const products = asObj(o.productsSummary);
  const summary = asObj(o.summary);
  const byCategoryRaw = Array.isArray(o.byCategory) ? o.byCategory : [];
  const dailyRaw = Array.isArray(o.dailyIncome) ? o.dailyIncome : [];
  const itemsRaw = Array.isArray(products?.items) ? products!.items : [];

  const byKind = {
    FIXED: num(byKindObj?.FIXED),
    PETTY: num(byKindObj?.PETTY),
    OTHER: num(byKindObj?.OTHER),
  };
  const summaryFixed = num(summary?.fixed, byKind.FIXED);
  const summaryPetty = num(summary?.petty, byKind.PETTY);
  const summaryOther = num(summary?.other, byKind.OTHER);
  const expensesSoFar = num(o.expensesSoFar, summaryFixed + summaryPetty + summaryOther);
  const incomeSoFar = num(o.incomeSoFar, num(summary?.totalSales));
  const netSoFar = num(o.netSoFar, num(summary?.netIncome, incomeSoFar - expensesSoFar));

  return {
    gymId: num(o.gymId),
    month: pickStr(o.month) || fallbackMonth,
    currency: pickStr(o.currency) || 'PKR',
    incomeSoFar,
    membershipIncomeSoFar: num(o.membershipIncomeSoFar),
    posSalesSoFar: num(o.posSalesSoFar),
    expensesSoFar,
    netSoFar,
    byKind,
    byCategory: byCategoryRaw
      .map((item) => {
        const c = asObj(item);
        if (!c) return null;
        const categoryId = num(c.categoryId ?? c.id);
        if (!categoryId && !pickStr(c.name)) return null;
        return {
          categoryId,
          name: pickStr(c.name) || '—',
          kind: asKind(c.kind),
          amount: num(c.amount),
        };
      })
      .filter((c): c is PnlSummary['byCategory'][number] => c != null)
      .sort((a, b) => b.amount - a.amount),
    remainingRecurring: num(o.remainingRecurring),
    paceProjection: {
      projectedIncome: num(pace?.projectedIncome),
      projectedExpenses: num(pace?.projectedExpenses),
      projectedNet: num(pace?.projectedNet),
      dayOfMonth: num(pace?.dayOfMonth),
      daysInMonth: num(pace?.daysInMonth),
    },
    duesProjection: {
      expectedRemaining: num(dues?.expectedRemaining),
      projectedIncome: num(dues?.projectedIncome),
      projectedExpenses: num(dues?.projectedExpenses),
      projectedNet: num(dues?.projectedNet),
    },
    dailyIncome: dailyRaw
      .map((item) => {
        const d = asObj(item);
        if (!d) return null;
        const date = dayOnly(d.date);
        if (!date) return null;
        return {
          date,
          amount: num(d.amount),
          paymentCount: num(d.paymentCount),
          memberCount: num(d.memberCount),
        };
      })
      .filter((d): d is PnlSummary['dailyIncome'][number] => d != null),
    productsSummary: {
      soldAmount: num(products?.soldAmount),
      soldQuantity: num(products?.soldQuantity),
      items: itemsRaw
        .map((item) => {
          const p = asObj(item);
          if (!p) return null;
          return {
            productId: num(p.productId ?? p.id),
            name: pickStr(p.name) || '—',
            stockQuantity: num(p.stockQuantity),
            soldQuantity: num(p.soldQuantity),
            soldAmount: num(p.soldAmount),
          };
        })
        .filter((p): p is PnlSummary['productsSummary']['items'][number] => p != null),
    },
    summary: {
      totalSales: num(summary?.totalSales, incomeSoFar),
      fixed: summaryFixed,
      petty: summaryPetty,
      other: summaryOther,
      totalExpense: num(summary?.totalExpense, expensesSoFar),
      netIncome: num(summary?.netIncome, netSoFar),
    },
  };
}

export async function fetchPnlSummary(month?: string): Promise<PnlSummary> {
  const ym = month || currentExpenseMonth();
  const res = await api.get('/api/dashboard/pnl-summary', {
    params: month ? { month } : undefined,
  });
  return normalizePnl(unwrapData(res.data), ym);
}

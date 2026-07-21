import api from '@/lib/api';
import { getErrorMessage, isAuthDeniedError, isForbiddenError } from '@/lib/errorHandler';
import type {
  PosAnalyticsRow,
  PosCategory,
  PosPagination,
  PosProduct,
  PosProductType,
  PosReportSummaryRow,
  PosSale,
  PosStockHistoryEntry,
  PosSubcategory,
  NutrientForm,
} from './types';

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function pickStr(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function unwrapData(body: unknown): unknown {
  const root = asObj(body);
  if (root?.success === true && root.data != null) return root.data;
  return body;
}

function normalizeSubcategory(row: unknown): PosSubcategory | null {
  const o = asObj(row);
  if (!o) return null;
  const id = num(o.id);
  if (!id) return null;
  const allowedRaw = o.allowedForms;
  const allowedForms = Array.isArray(allowedRaw)
    ? (allowedRaw.filter((f) => f === 'PACKAGED' || f === 'SERVING') as NutrientForm[])
    : undefined;
  return {
    id,
    categoryId: num(o.categoryId),
    name: pickStr(o.name) || '—',
    productType: (pickStr(o.productType).toUpperCase() as PosProductType) || undefined,
    allowedForms,
    enabledForGym: o.enabledForGym === true || o.isEnabled === true,
    sortOrder: num(o.sortOrder),
  };
}

export function normalizeCategory(row: unknown, fallbackProductType?: PosProductType): PosCategory | null {
  const o = asObj(row);
  if (!o) return null;
  const id = num(o.id);
  if (!id) return null;
  const productType =
    (pickStr(o.productType).toUpperCase() as PosProductType) ||
    fallbackProductType ||
    'NUTRIENT';
  const productTypeNorm: PosProductType = productType === 'ACCESSORY' ? 'ACCESSORY' : 'NUTRIENT';
  const subsRaw = o.subcategories ?? o.subCategories;
  const subcategories = Array.isArray(subsRaw)
    ? subsRaw
        .map((sub) => {
          const normalized = normalizeSubcategory(sub);
          if (!normalized) return null;
          return {
            ...normalized,
            categoryId: normalized.categoryId || id,
            productType: normalized.productType || productTypeNorm,
          };
        })
        .filter((s): s is PosSubcategory => s != null)
    : [];
  return {
    id,
    name: pickStr(o.name) || '—',
    productType: productTypeNorm,
    sortOrder: num(o.sortOrder),
    subcategories,
  };
}

/**
 * Normalize POS catalog payloads.
 * Supports:
 * - Nested platform shape: { catalog: [{ productType, categories: [...] }] }
 * - Flat: { categories: [...] } | { catalog: [category, ...] } | category[]
 */
export function normalizePosCatalogResponse(data: unknown): PosCategory[] {
  const root = asObj(data);
  const catalogRaw = root?.catalog;
  const categoriesRaw = root?.categories;

  const asGroups = Array.isArray(catalogRaw)
    ? catalogRaw
    : Array.isArray(data)
      ? data
      : null;

  if (asGroups && asGroups.length > 0) {
    const first = asObj(asGroups[0]);
    const looksLikeProductTypeGroup =
      Boolean(first) &&
      Array.isArray(first?.categories) &&
      Boolean(pickStr(first?.productType)) &&
      !num(first?.id);

    if (looksLikeProductTypeGroup) {
      const out: PosCategory[] = [];
      for (const group of asGroups) {
        const g = asObj(group);
        if (!g) continue;
        const groupType = pickStr(g.productType).toUpperCase() as PosProductType;
        const fallback: PosProductType = groupType === 'ACCESSORY' ? 'ACCESSORY' : 'NUTRIENT';
        const cats = Array.isArray(g.categories) ? g.categories : [];
        for (const cat of cats) {
          const normalized = normalizeCategory(cat, fallback);
          if (normalized) out.push(normalized);
        }
      }
      return out;
    }
  }

  const flatList = Array.isArray(categoriesRaw)
    ? categoriesRaw
    : Array.isArray(catalogRaw)
      ? catalogRaw
      : Array.isArray(data)
        ? data
        : [];

  return flatList.map((row) => normalizeCategory(row)).filter((c): c is PosCategory => c != null);
}

export function normalizeProduct(row: unknown): PosProduct | null {
  const o = asObj(row);
  if (!o) return null;
  const id = num(o.id);
  if (!id) return null;
  const productType = pickStr(o.productType).toUpperCase() as PosProductType;
  return {
    id,
    productType: productType === 'ACCESSORY' ? 'ACCESSORY' : 'NUTRIENT',
    subcategoryId: num(o.subcategoryId),
    subcategoryName: pickStr(o.subcategoryName) || undefined,
    categoryName: pickStr(o.categoryName) || undefined,
    name: pickStr(o.name) || '—',
    sku: pickStr(o.sku) || null,
    imageUrl: pickStr(o.imageUrl ?? o.image) || null,
    price: num(o.price),
    discount: o.discount != null ? num(o.discount) : null,
    isActive: o.isActive !== false,
    form: (pickStr(o.form).toUpperCase() as NutrientForm) || null,
    brand: pickStr(o.brand) || null,
    description: pickStr(o.description) || null,
    servingSizeG: o.servingSizeG != null ? num(o.servingSizeG) : null,
    calories: o.calories != null ? num(o.calories) : null,
    proteinG: o.proteinG != null ? num(o.proteinG) : null,
    carbsG: o.carbsG != null ? num(o.carbsG) : null,
    fatG: o.fatG != null ? num(o.fatG) : null,
    fiberG: o.fiberG != null ? num(o.fiberG) : null,
    sugarG: o.sugarG != null ? num(o.sugarG) : null,
    material: pickStr(o.material) || null,
    color: pickStr(o.color) || null,
    size: pickStr(o.size) || null,
    trackInventory: o.trackInventory !== false,
    stockQuantity: o.stockQuantity != null ? num(o.stockQuantity) : null,
    lowStockThreshold: o.lowStockThreshold != null ? num(o.lowStockThreshold) : null,
    isLowStock: o.isLowStock === true,
    subcategoryEnabled: o.subcategoryEnabled !== false && o.subcategoryDisabled !== true,
    initialStock: o.initialStock != null ? num(o.initialStock) : null,
  };
}

function normalizeSale(row: unknown): PosSale | null {
  const o = asObj(row);
  if (!o) return null;
  const id = num(o.id);
  if (!id) return null;
  const itemsRaw = o.items ?? o.lines ?? o.saleItems;
  const items = Array.isArray(itemsRaw)
    ? itemsRaw.map((line) => {
        const l = asObj(line);
        if (!l) return null;
        return {
          id: num(l.id) || undefined,
          productId: num(l.productId),
          productName: pickStr(l.productName ?? l.name) || undefined,
          quantity: num(l.quantity, 1),
          unitPrice: num(l.unitPrice ?? l.price),
          discountType: (pickStr(l.discountType).toUpperCase() as 'PERCENT' | 'FLAT') || null,
          discountValue: l.discountValue != null ? num(l.discountValue) : null,
          lineTotal: num(l.lineTotal ?? l.total),
        };
      }).filter(Boolean)
    : [];
  return {
    id,
    receiptNo: pickStr(o.receiptNo ?? o.receiptNumber) || `#${id}`,
    status: (pickStr(o.status).toUpperCase() as PosSale['status']) || 'COMPLETED',
    memberId: o.memberId != null ? num(o.memberId) : null,
    memberName: pickStr(o.memberName) || null,
    memberPhone: pickStr(o.memberPhone ?? o.memberContact ?? o.contact ?? o.phone) || null,
    notes: pickStr(o.notes) || null,
    subtotal: num(o.subtotal),
    discountTotal: num(o.discountTotal),
    total: num(o.total),
    createdAt: pickStr(o.createdAt) || new Date().toISOString(),
    voidedAt: pickStr(o.voidedAt) || null,
    voidReason: pickStr(o.voidReason) || null,
    items: items as PosSale['items'],
  };
}

function normalizePagination(raw: unknown, fallbackPage: number, fallbackLimit: number): PosPagination {
  const o = asObj(raw);
  const p = asObj(o?.pagination) ?? o;
  return {
    page: num(p?.page, fallbackPage),
    limit: num(p?.limit, fallbackLimit),
    total: num(p?.total),
    totalPages: num(p?.totalPages, 1),
  };
}

export function posErrorMessage(err: unknown): string {
  if (isAuthDeniedError(err) || isForbiddenError(err)) {
    return "You don't have permission to perform this action.";
  }
  return getErrorMessage(err);
}

// ─── Gym catalog & setup ───────────────────────────────────────────────────

export async function fetchPosCatalog(includeDisabled = true): Promise<PosCategory[]> {
  const res = await api.get('/api/pos/catalog', {
    params: { includeDisabled: includeDisabled ? 'true' : 'false' },
  });
  return normalizePosCatalogResponse(unwrapData(res.data));
}

export async function saveGymSubcategories(subcategoryIds: number[]): Promise<void> {
  await api.put('/api/pos/gym-subcategories', { subcategoryIds });
}

// ─── Products ──────────────────────────────────────────────────────────────

export async function fetchPosProducts(params: {
  productType?: PosProductType;
  search?: string;
  page?: number;
  limit?: number;
  includeInactive?: boolean;
}): Promise<{ products: PosProduct[]; pagination: PosPagination }> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const res = await api.get('/api/pos/products', {
    params: {
      productType: params.productType,
      search: params.search || undefined,
      page,
      limit,
      includeInactive: params.includeInactive ? 'true' : undefined,
    },
  });
  const data = unwrapData(res.data);
  const root = asObj(data);
  const list = Array.isArray(data)
    ? data
    : Array.isArray(root?.products)
      ? root!.products
      : [];
  return {
    products: list.map(normalizeProduct).filter((p): p is PosProduct => p != null),
    pagination: normalizePagination(root?.pagination ?? root, page, limit),
  };
}

export async function fetchPosProduct(id: number | string): Promise<PosProduct> {
  const res = await api.get(`/api/pos/products/${id}`);
  const data = unwrapData(res.data);
  const root = asObj(data);
  const row = root?.product ?? data;
  const product = normalizeProduct(row);
  if (!product) throw new Error('Product not found');
  return product;
}

export async function createPosProduct(body: Record<string, unknown>): Promise<PosProduct> {
  const res = await api.post('/api/pos/products', body);
  const data = unwrapData(res.data);
  const root = asObj(data);
  const product = normalizeProduct(root?.product ?? data);
  if (!product) throw new Error('Invalid product response');
  return product;
}

export async function updatePosProduct(id: number | string, body: Record<string, unknown>): Promise<PosProduct> {
  const res = await api.patch(`/api/pos/products/${id}`, body);
  const data = unwrapData(res.data);
  const root = asObj(data);
  const product = normalizeProduct(root?.product ?? data);
  if (!product) throw new Error('Invalid product response');
  return product;
}

// ─── Inventory ─────────────────────────────────────────────────────────────

export async function fetchStockHistory(productId: number | string): Promise<PosStockHistoryEntry[]> {
  const res = await api.get(`/api/pos/products/${productId}/stock-history`);
  const data = unwrapData(res.data);
  const root = asObj(data);
  const list = Array.isArray(data)
    ? data
    : Array.isArray(root?.history)
      ? root!.history
      : Array.isArray(root?.entries)
        ? root!.entries
        : [];
  const out: PosStockHistoryEntry[] = [];
  for (const row of list) {
    const o = asObj(row);
    if (!o) continue;
    const createdAt = pickStr(o.createdAt);
    const id = num(o.id);
    if (!id && !createdAt) continue;
    out.push({
      id,
      productId: num(o.productId),
      changeType: pickStr(o.changeType ?? o.type) || 'ADJUST',
      quantityChange: num(o.quantityChange ?? o.change),
      stockAfter: num(o.stockAfter ?? o.quantityAfter),
      note: pickStr(o.note) || null,
      createdAt: createdAt || '',
      createdByName: pickStr(o.createdByName ?? o.userName) || null,
    });
  }
  return out;
}

export async function restockProduct(
  productId: number | string,
  quantity: number,
  note?: string
): Promise<void> {
  await api.post(`/api/pos/products/${productId}/restock`, { quantity, note });
}

export async function adjustStock(
  productId: number | string,
  stockQuantity: number,
  note?: string
): Promise<void> {
  await api.post(`/api/pos/products/${productId}/adjust-stock`, { stockQuantity, note });
}

// ─── Sales ─────────────────────────────────────────────────────────────────

export async function createPosSale(body: {
  memberId?: number | null;
  notes?: string;
  items: Array<{
    productId: number;
    quantity: number;
    discountType?: string;
    discountValue?: number;
  }>;
}): Promise<PosSale> {
  const res = await api.post('/api/pos/sales', body);
  const data = unwrapData(res.data);
  const root = asObj(data);
  const sale = normalizeSale(root?.sale ?? data);
  if (!sale) throw new Error('Invalid sale response');
  return sale;
}

export async function fetchPosSales(params: {
  from?: string;
  to?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{ sales: PosSale[]; pagination: PosPagination }> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const res = await api.get('/api/pos/sales', { params: { ...params, page, limit } });
  const data = unwrapData(res.data);
  const root = asObj(data);
  const list = Array.isArray(data)
    ? data
    : Array.isArray(root?.sales)
      ? root!.sales
      : [];
  return {
    sales: list.map(normalizeSale).filter((s): s is PosSale => s != null),
    pagination: normalizePagination(root?.pagination ?? root, page, limit),
  };
}

export async function voidPosSale(id: number | string, reason: string): Promise<PosSale> {
  const res = await api.post(`/api/pos/sales/${id}/void`, { reason });
  const data = unwrapData(res.data);
  const root = asObj(data);
  const sale = normalizeSale(root?.sale ?? data);
  if (!sale) throw new Error('Invalid void response');
  return sale;
}

// ─── Reports ───────────────────────────────────────────────────────────────

export async function fetchPosReportSummary(params: {
  groupBy: 'day' | 'category' | 'subcategory' | 'product';
  from?: string;
  to?: string;
}): Promise<{ rows: PosReportSummaryRow[]; totals: PosReportSummaryRow }> {
  const res = await api.get('/api/pos/reports/summary', { params });
  const data = unwrapData(res.data);
  const root = asObj(data);
  const rowsRaw = root?.rows ?? root?.summary ?? data;
  const rows = Array.isArray(rowsRaw)
    ? rowsRaw.map((row) => {
        const o = asObj(row);
        if (!o) return null;
        return {
          key: pickStr(o.key ?? o.id ?? o.label),
          label: pickStr(o.label ?? o.name ?? o.key) || '—',
          saleCount: num(o.saleCount),
          subtotal: num(o.subtotal),
          discountTotal: num(o.discountTotal),
          total: num(o.total ?? o.revenue),
        };
      }).filter((r): r is PosReportSummaryRow => r != null)
    : [];
  const t = asObj(root?.totals) ?? {};
  const totals: PosReportSummaryRow = {
    key: 'total',
    label: 'Total',
    saleCount: num(t.saleCount),
    subtotal: num(t.subtotal),
    discountTotal: num(t.discountTotal),
    total: num(t.total ?? t.revenue),
  };
  return { rows, totals };
}

// ─── Checkout helpers ─────────────────────────────────────────────────────

export async function searchPosCheckoutProducts(params: {
  search?: string;
  subcategoryId?: number;
  productType?: PosProductType;
}): Promise<PosProduct[]> {
  const { products } = await fetchPosProducts({
    productType: params.productType,
    search: params.search,
    page: 1,
    limit: 200,
    includeInactive: false,
  });
  return products.filter((p) => p.isActive && p.subcategoryEnabled !== false);
}

export async function searchMembersForPos(
  query: string
): Promise<Array<{ id: number; name: string; memberNumber?: string; phone?: string }>> {
  const res = await api.get('/api/members', { params: { search: query, limit: 20 } });
  const data = unwrapData(res.data);
  const root = asObj(data);
  const list = Array.isArray(root?.members) ? root!.members : [];
  const out: Array<{ id: number; name: string; memberNumber?: string; phone?: string }> = [];
  for (const m of list) {
    const o = asObj(m);
    if (!o) continue;
    const id = num(o.id);
    if (!id) continue;
    const memberNumber = pickStr(o.memberNumber ?? o.legacyMemberId);
    const phone = pickStr(o.phone ?? o.contact);
    out.push({
      id,
      name: pickStr(o.name) || '—',
      ...(memberNumber ? { memberNumber } : {}),
      ...(phone ? { phone } : {}),
    });
  }
  return out;
}

// ─── Platform analytics (via gym api module for reuse in platform page) ───
// Platform POS lives in lib/platform/posApi.ts

export function normalizeAnalyticsRows(raw: unknown): PosAnalyticsRow[] {
  const root = asObj(raw);
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(root?.rows)
      ? root!.rows
      : Array.isArray(root?.data)
        ? root!.data
        : [];
  const out: PosAnalyticsRow[] = [];
  for (const row of list) {
    const o = asObj(row);
    if (!o) continue;
    out.push({
      key: pickStr(o.key ?? o.id ?? o.label),
      label: pickStr(o.label ?? o.name ?? o.gymName) || '—',
      saleCount: num(o.saleCount),
      revenue: num(o.revenue ?? o.total),
      quantity: o.quantity != null ? num(o.quantity) : undefined,
    });
  }
  return out;
}

import type { NutrientForm, PosProduct } from '@/lib/pos/types';

/** Checkout / list filter for nutrient products. "Nutrient" = packaged sell unit. */
export type PosNutrientSellFilter = 'ALL' | 'NUTRIENT' | 'SERVING';

/** Classify Packaged / Serving from subcategory display name. */
export function classifySubcategoryName(name?: string | null): NutrientForm | null {
  const n = (name || '').trim().toLowerCase();
  if (!n) return null;
  if (n === 'serving' || n.includes('serving')) return 'SERVING';
  if (n === 'packaged' || n.includes('packaged')) return 'PACKAGED';
  return null;
}

export function resolveProductNutrientForm(
  product: {
    form?: NutrientForm | null;
    subcategoryId?: number;
    subcategoryName?: string | null;
  },
  packagedIds?: Set<number>,
  servingIds?: Set<number>
): NutrientForm | null {
  if (product.form === 'PACKAGED' || product.form === 'SERVING') return product.form;

  const fromName = classifySubcategoryName(product.subcategoryName);
  if (fromName) return fromName;

  const id = Number(product.subcategoryId);
  if (id && servingIds?.has(id)) return 'SERVING';
  if (id && packagedIds?.has(id)) return 'PACKAGED';

  return null;
}

/** Maps UI filter → API `form` query (omit for All). */
export function nutrientSellFilterToApiForm(
  filter: PosNutrientSellFilter
): NutrientForm | undefined {
  if (filter === 'NUTRIENT') return 'PACKAGED';
  if (filter === 'SERVING') return 'SERVING';
  return undefined;
}

export function nutrientFormBadgeLabel(form: NutrientForm | null | undefined): string | null {
  if (form === 'PACKAGED') return 'Nutrient';
  if (form === 'SERVING') return 'Serving';
  return null;
}

export function buildNutrientSubcategoryIdSets(
  subs: Array<{ id: number; name: string }>
): { packagedIds: Set<number>; servingIds: Set<number> } {
  const packagedIds = new Set<number>();
  const servingIds = new Set<number>();
  for (const s of subs) {
    const kind = classifySubcategoryName(s.name);
    if (kind === 'PACKAGED') packagedIds.add(s.id);
    if (kind === 'SERVING') servingIds.add(s.id);
  }
  return { packagedIds, servingIds };
}

export function matchesNutrientSellFilter(
  product: PosProduct,
  filter: PosNutrientSellFilter,
  packagedIds?: Set<number>,
  servingIds?: Set<number>
): boolean {
  if (filter === 'ALL') return true;
  const form = resolveProductNutrientForm(product, packagedIds, servingIds);
  if (filter === 'SERVING') return form === 'SERVING';
  // Nutrient tab = packaged (tub / retail), not scoop servings
  return form === 'PACKAGED';
}

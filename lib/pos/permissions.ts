/** Gym POS permission keys (mirrors backend catalog). */
export const POS_PERMISSION_KEYS = {
  catalogRead: 'gym.pos.catalog.read',
  productsManage: 'gym.pos.products.manage',
  inventoryManage: 'gym.pos.inventory.manage',
  sell: 'gym.pos.sell',
  discountsManage: 'gym.pos.discounts.manage',
  revenueRead: 'gym.pos.revenue.read',
} as const;

/** Fallback catalog entries when backend permission list omits POS keys. */
export const POS_TEAM_PERMISSION_DEFS = [
  {
    key: POS_PERMISSION_KEYS.catalogRead,
    label: 'View POS catalog',
    description: 'View products and sales history',
    group: 'Point of sale',
  },
  {
    key: POS_PERMISSION_KEYS.productsManage,
    label: 'Manage POS products',
    description: 'Enable subcategories and create or edit products',
    group: 'Point of sale',
  },
  {
    key: POS_PERMISSION_KEYS.inventoryManage,
    label: 'Manage POS inventory',
    description: 'Restock and adjust stock levels',
    group: 'Point of sale',
  },
  {
    key: POS_PERMISSION_KEYS.sell,
    label: 'Sell at POS',
    description: 'Checkout and void sales',
    group: 'Point of sale',
  },
  {
    key: POS_PERMISSION_KEYS.discountsManage,
    label: 'Manage POS discounts',
    description: 'Override line discounts at checkout',
    group: 'Point of sale',
  },
  {
    key: POS_PERMISSION_KEYS.revenueRead,
    label: 'View POS revenue',
    description: 'View POS revenue reports',
    group: 'Point of sale',
  },
] as const;

export function hasAnyPosPermission(can: (key: string) => boolean): boolean {
  return Object.values(POS_PERMISSION_KEYS).some((k) => can(k));
}

export function firstPosPath(can: (key: string) => boolean): string {
  if (can(POS_PERMISSION_KEYS.sell)) return '/pos/checkout';
  if (can(POS_PERMISSION_KEYS.productsManage)) return '/pos/setup';
  if (can(POS_PERMISSION_KEYS.catalogRead)) return '/pos/products';
  if (can(POS_PERMISSION_KEYS.revenueRead)) return '/pos/reports';
  return '/pos/products';
}

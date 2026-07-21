export type PosProductType = 'NUTRIENT' | 'ACCESSORY';
export type NutrientForm = 'PACKAGED' | 'SERVING';
export type PosSaleStatus = 'COMPLETED' | 'VOIDED' | 'PENDING';
export type PosDiscountType = 'PERCENT' | 'FLAT';

export interface PosCategory {
  id: number;
  name: string;
  productType: PosProductType;
  sortOrder?: number;
  subcategories?: PosSubcategory[];
}

export interface PosSubcategory {
  id: number;
  categoryId: number;
  name: string;
  productType?: PosProductType;
  allowedForms?: NutrientForm[];
  enabledForGym?: boolean;
  sortOrder?: number;
}

export interface PosProduct {
  id: number;
  productType: PosProductType;
  subcategoryId: number;
  subcategoryName?: string;
  categoryName?: string;
  name: string;
  sku?: string | null;
  imageUrl?: string | null;
  price: number;
  discount?: number | null;
  isActive: boolean;
  form?: NutrientForm | null;
  brand?: string | null;
  description?: string | null;
  servingSizeG?: number | null;
  calories?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  fiberG?: number | null;
  sugarG?: number | null;
  material?: string | null;
  color?: string | null;
  size?: string | null;
  trackInventory?: boolean;
  stockQuantity?: number | null;
  lowStockThreshold?: number | null;
  isLowStock?: boolean;
  subcategoryEnabled?: boolean;
  initialStock?: number | null;
}

export interface PosStockHistoryEntry {
  id: number;
  productId: number;
  changeType: string;
  quantityChange: number;
  stockAfter: number;
  note?: string | null;
  createdAt: string;
  createdByName?: string | null;
}

export interface PosSaleLine {
  id?: number;
  productId: number;
  productName?: string;
  quantity: number;
  unitPrice: number;
  discountType?: PosDiscountType | null;
  discountValue?: number | null;
  lineTotal: number;
}

export interface PosSale {
  id: number;
  receiptNo: string;
  status: PosSaleStatus;
  memberId?: number | null;
  memberName?: string | null;
  /** Member phone/contact when available (for WhatsApp receipt). */
  memberPhone?: string | null;
  notes?: string | null;
  subtotal: number;
  discountTotal: number;
  total: number;
  createdAt: string;
  voidedAt?: string | null;
  voidReason?: string | null;
  items: PosSaleLine[];
}

export interface PosReportSummaryRow {
  key: string;
  label: string;
  saleCount: number;
  subtotal: number;
  discountTotal: number;
  total: number;
}

export interface PosPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PosCartItem {
  product: PosProduct;
  quantity: number;
  discountType?: PosDiscountType;
  discountValue?: number;
}

export interface PosAnalyticsRow {
  key: string;
  label: string;
  saleCount: number;
  revenue: number;
  quantity?: number;
}

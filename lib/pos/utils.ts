import type { PosCartItem, PosDiscountType, PosProduct } from './types';

export function formatMoney(amount: number, currency = 'PKR'): string {
  const n = Number(amount) || 0;
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function lineSubtotal(unitPrice: number, quantity: number): number {
  return Math.max(0, (Number(unitPrice) || 0) * (Number(quantity) || 0));
}

export function applyLineDiscount(
  subtotal: number,
  discountType?: PosDiscountType | null,
  discountValue?: number | null
): number {
  const base = Math.max(0, subtotal);
  if (!discountType || discountValue == null || discountValue <= 0) return base;
  if (discountType === 'PERCENT') {
    const pct = Math.min(100, Math.max(0, Number(discountValue) || 0));
    return Math.max(0, base * (1 - pct / 100));
  }
  const flat = Math.min(base, Math.max(0, Number(discountValue) || 0));
  return Math.max(0, base - flat);
}

export function cartLineTotal(item: PosCartItem): number {
  const sub = lineSubtotal(item.product.price, item.quantity);
  return applyLineDiscount(sub, item.discountType, item.discountValue);
}

export function cartTotals(items: PosCartItem[]) {
  let subtotal = 0;
  let total = 0;
  for (const item of items) {
    const sub = lineSubtotal(item.product.price, item.quantity);
    subtotal += sub;
    total += cartLineTotal(item);
  }
  return {
    subtotal,
    discountTotal: Math.max(0, subtotal - total),
    total,
  };
}

export function availableStock(product: PosProduct): number | null {
  if (product.trackInventory === false) return null;
  return Math.max(0, Number(product.stockQuantity) || 0);
}

export function canAddToCart(product: PosProduct, qty: number, currentInCart = 0): boolean {
  if (!product.isActive) return false;
  if (product.subcategoryEnabled === false) return false;
  const stock = availableStock(product);
  if (stock == null) return qty > 0;
  return currentInCart + qty <= stock;
}

export function validateDiscount(
  subtotal: number,
  discountType?: PosDiscountType,
  discountValue?: number
): string | null {
  if (!discountType || discountValue == null || discountValue <= 0) return null;
  if (discountType === 'PERCENT' && discountValue > 100) {
    return 'Percent discount cannot exceed 100%.';
  }
  if (discountType === 'FLAT' && discountValue > subtotal) {
    return 'Flat discount cannot exceed line total.';
  }
  return null;
}

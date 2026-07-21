'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@/components/Alert';
import Loading from '@/components/Loading';
import PosPermissionGate from '@/components/pos/PosPermissionGate';
import PosReceiptModal from '@/components/pos/PosReceiptModal';
import PosProductTypeTabs from '@/components/pos/PosProductTypeTabs';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import {
  createPosSale,
  fetchPosCatalog,
  posErrorMessage,
  searchMembersForPos,
  searchPosCheckoutProducts,
} from '@/lib/pos/posApi';
import { POS_PERMISSION_KEYS } from '@/lib/pos/permissions';
import {
  applyLineDiscount,
  availableStock,
  canAddToCart,
  cartLineTotal,
  cartTotals,
  formatMoney,
  lineSubtotal,
  validateDiscount,
} from '@/lib/pos/utils';
import type { PosCartItem, PosDiscountType, PosProduct, PosProductType, PosSale } from '@/lib/pos/types';

export default function PosCheckoutPage() {
  const { can } = useAuth();
  const canSell = can(POS_PERMISSION_KEYS.sell);
  const canDiscount = can(POS_PERMISSION_KEYS.discountsManage);
  const { alert, showAlert, closeAlert } = useAlert();

  const [productType, setProductType] = useState<PosProductType>('NUTRIENT');
  const [search, setSearch] = useState('');
  const [subcategoryId, setSubcategoryId] = useState<number | ''>('');
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [notes, setNotes] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<Array<{ id: number; name: string; memberNumber?: string }>>([]);
  const [memberId, setMemberId] = useState<number | null>(null);
  const [memberName, setMemberName] = useState('');
  const [receipt, setReceipt] = useState<PosSale | null>(null);
  const [subcategories, setSubcategories] = useState<Array<{ id: number; name: string }>>([]);

  const loadCatalog = useCallback(async () => {
    const cats = await fetchPosCatalog(false);
    const subs: Array<{ id: number; name: string; productType: PosProductType }> = [];
    for (const c of cats) {
      for (const s of c.subcategories ?? []) {
        if (s.enabledForGym !== false) subs.push({ id: s.id, name: s.name, productType: c.productType });
      }
    }
    setSubcategories(subs.filter((s) => s.productType === productType).map(({ id, name }) => ({ id, name })));
  }, [productType]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      let list = await searchPosCheckoutProducts({ search, productType });
      if (subcategoryId) list = list.filter((p) => p.subcategoryId === subcategoryId);
      setProducts(list);
    } catch (e) {
      showAlert('error', 'Could not load products', posErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [search, productType, subcategoryId, showAlert]);

  useEffect(() => {
    if (canSell) void loadCatalog();
  }, [canSell, loadCatalog]);

  useEffect(() => {
    if (canSell) void loadProducts();
  }, [canSell, loadProducts]);

  useEffect(() => {
    setSubcategoryId('');
  }, [productType]);

  const totals = useMemo(() => cartTotals(cart), [cart]);

  const qtyInCart = (productId: number) =>
    cart.filter((c) => c.product.id === productId).reduce((s, c) => s + c.quantity, 0);

  const addToCart = (product: PosProduct) => {
    const inCart = qtyInCart(product.id);
    if (!canAddToCart(product, 1, inCart)) {
      const stock = availableStock(product);
      showAlert('warning', 'Insufficient stock', stock != null ? `Only ${stock - inCart} available.` : 'Cannot add this product.');
      return;
    }
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((c) => c.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((c) => {
        if (c.product.id !== productId) return c;
        if (!canAddToCart(c.product, quantity, 0)) {
          const stock = availableStock(c.product);
          showAlert('warning', 'Insufficient stock', stock != null ? `Only ${stock} available.` : 'Invalid quantity.');
          return c;
        }
        return { ...c, quantity };
      })
    );
  };

  const updateLineDiscount = (productId: number, discountType?: PosDiscountType, discountValue?: number) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.product.id !== productId) return c;
        const sub = lineSubtotal(c.product.price, c.quantity);
        const err = validateDiscount(sub, discountType, discountValue);
        if (err) {
          showAlert('warning', 'Invalid discount', err);
          return c;
        }
        return { ...c, discountType, discountValue };
      })
    );
  };

  const searchMembers = async () => {
    if (!memberQuery.trim()) return;
    try {
      const rows = await searchMembersForPos(memberQuery.trim());
      setMemberResults(rows);
    } catch (e) {
      showAlert('error', 'Member search failed', posErrorMessage(e));
    }
  };

  const checkout = async () => {
    if (cart.length === 0) {
      showAlert('warning', 'Empty cart', 'Add at least one product.');
      return;
    }
    setCheckingOut(true);
    try {
      const sale = await createPosSale({
        memberId,
        notes: notes.trim() || undefined,
        items: cart.map((c) => ({
          productId: c.product.id,
          quantity: c.quantity,
          ...(canDiscount && c.discountType && c.discountValue
            ? { discountType: c.discountType, discountValue: c.discountValue }
            : {}),
        })),
      });
      setReceipt(sale);
      setCart([]);
      setNotes('');
      setMemberId(null);
      setMemberName('');
      await loadProducts();
    } catch (e) {
      showAlert('error', 'Checkout failed', posErrorMessage(e));
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <>
      <Alert isOpen={alert.isOpen} onClose={closeAlert} type={alert.type} title={alert.title} message={alert.message} />
      <PosReceiptModal sale={receipt} onClose={() => setReceipt(null)} />
      <h1 className="mb-4 text-2xl font-bold text-dark-gray">POS Checkout</h1>
      <PosPermissionGate allowed={canSell} message="You need Sell at POS permission to checkout.">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-wrap gap-3">
              <PosProductTypeTabs value={productType} onChange={setProductType} />
              <select
                className="rounded-lg border px-3 py-2 text-sm"
                value={subcategoryId}
                onChange={(e) => setSubcategoryId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">All subcategories</option>
                {subcategories.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {loading ? (
              <Loading message="Loading products…" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((p) => {
                  const stock = availableStock(p);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addToCart(p)}
                      className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-primary/40"
                    >
                      <p className="font-medium text-dark-gray">{p.name}</p>
                      <p className="mt-1 text-sm text-primary">{formatMoney(p.price)}</p>
                      {stock != null && <p className="mt-1 text-xs text-gray-500">Stock: {stock}</p>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold">Cart</h2>
            {cart.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">Cart is empty.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {cart.map((item) => {
                  const sub = lineSubtotal(item.product.price, item.quantity);
                  return (
                    <li key={item.product.id} className="rounded-lg bg-gray-50 p-3 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">{item.product.name}</span>
                        <span>{formatMoney(cartLineTotal(item))}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button type="button" className="rounded border px-2" onClick={() => updateQty(item.product.id, item.quantity - 1)}>−</button>
                        <span>{item.quantity}</span>
                        <button type="button" className="rounded border px-2" onClick={() => updateQty(item.product.id, item.quantity + 1)}>+</button>
                      </div>
                      {canDiscount && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <select
                            className="rounded border px-2 py-1 text-xs"
                            value={item.discountType ?? ''}
                            onChange={(e) =>
                              updateLineDiscount(
                                item.product.id,
                                (e.target.value as PosDiscountType) || undefined,
                                item.discountValue
                              )
                            }
                          >
                            <option value="">No discount</option>
                            <option value="PERCENT">Percent</option>
                            <option value="FLAT">Flat</option>
                          </select>
                          <input
                            type="number"
                            className="rounded border px-2 py-1 text-xs"
                            placeholder="Value"
                            value={item.discountValue ?? ''}
                            onChange={(e) =>
                              updateLineDiscount(
                                item.product.id,
                                item.discountType,
                                e.target.value ? Number(e.target.value) : undefined
                              )
                            }
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-4 space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(totals.subtotal)}</span></div>
              {totals.discountTotal > 0 && (
                <div className="flex justify-between text-emerald-700"><span>Discount</span><span>-{formatMoney(totals.discountTotal)}</span></div>
              )}
              <div className="flex justify-between font-bold"><span>Total</span><span>{formatMoney(totals.total)}</span></div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex gap-2">
                <input className="flex-1 rounded border px-2 py-1 text-sm" placeholder="Link member (search)" value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} />
                <button type="button" onClick={searchMembers} className="rounded border px-2 text-sm">Find</button>
              </div>
              {memberResults.length > 0 && (
                <ul className="max-h-24 overflow-y-auto rounded border text-xs">
                  {memberResults.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        className="block w-full px-2 py-1 text-left hover:bg-gray-50"
                        onClick={() => { setMemberId(m.id); setMemberName(m.name); setMemberResults([]); }}
                      >
                        {m.name} {m.memberNumber ? `(${m.memberNumber})` : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {memberName && <p className="text-xs text-gray-600">Member: {memberName}</p>}
              <textarea className="w-full rounded border px-2 py-1 text-sm" rows={2} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <button
                type="button"
                disabled={checkingOut || cart.length === 0}
                onClick={checkout}
                className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {checkingOut ? 'Processing…' : 'Complete sale'}
              </button>
            </div>
          </div>
        </div>
      </PosPermissionGate>
    </>
  );
}

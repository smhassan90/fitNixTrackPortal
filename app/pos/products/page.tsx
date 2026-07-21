'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@/components/Alert';
import Loading from '@/components/Loading';
import PosPermissionGate from '@/components/pos/PosPermissionGate';
import PosProductForm, {
  buildProductPayload,
  emptyProductForm,
  productToForm,
  validateProductForm,
  type PosProductFormState,
} from '@/components/pos/PosProductForm';
import PosProductTypeTabs from '@/components/pos/PosProductTypeTabs';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import {
  createPosProduct,
  fetchPosCatalog,
  fetchPosProducts,
  posErrorMessage,
  updatePosProduct,
} from '@/lib/pos/posApi';
import { posProductImageErrorMessage, uploadPosProductImage } from '@/lib/pos/productImage';
import { POS_PERMISSION_KEYS } from '@/lib/pos/permissions';
import { formatMoney } from '@/lib/pos/utils';
import type { PosProduct, PosProductType, PosSubcategory } from '@/lib/pos/types';

export default function PosProductsPage() {
  const { can } = useAuth();
  const canView = can(POS_PERMISSION_KEYS.catalogRead);
  const canManage = can(POS_PERMISSION_KEYS.productsManage);
  const { alert, showAlert, closeAlert } = useAlert();

  const [productType, setProductType] = useState<PosProductType>('NUTRIENT');
  const [search, setSearch] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [subcategories, setSubcategories] = useState<PosSubcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PosProduct | null>(null);
  const [form, setForm] = useState<PosProductFormState>(emptyProductForm('NUTRIENT'));
  const [pendingImageBlob, setPendingImageBlob] = useState<Blob | null>(null);

  const enabledSubs = useMemo(
    () =>
      subcategories.filter(
        (s) => s.enabledForGym === true && (s.productType ?? productType) === productType
      ),
    [subcategories, productType]
  );

  const loadCatalog = useCallback(async () => {
    // Enabled-only catalog for product form dropdowns (not platform catalog).
    const cats = await fetchPosCatalog(false);
    const subs: PosSubcategory[] = [];
    for (const c of cats) {
      for (const s of c.subcategories ?? []) {
        subs.push({
          ...s,
          productType: s.productType ?? c.productType,
          enabledForGym: s.enabledForGym !== false,
        });
      }
    }
    setSubcategories(subs);
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchPosProducts({
        productType,
        search: searchApplied || undefined,
        page,
        limit: 20,
        includeInactive: true,
      });
      setProducts(result.products);
      setPagination(result.pagination);
    } catch (e) {
      showAlert('error', 'Could not load products', posErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [productType, searchApplied, page, showAlert]);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadCatalog();
  }, [canView, loadCatalog]);

  useEffect(() => {
    if (canView) void loadProducts();
  }, [canView, loadProducts]);

  useEffect(() => {
    setForm(emptyProductForm(productType));
    setEditing(null);
    setShowForm(false);
    setPage(1);
  }, [productType]);

  const startAdd = () => {
    setEditing(null);
    setPendingImageBlob(null);
    setForm(emptyProductForm(productType));
    setShowForm(true);
    void loadCatalog().catch((e) => {
      showAlert('error', 'Could not load categories', posErrorMessage(e));
    });
  };

  const startEdit = (p: PosProduct) => {
    setEditing(p);
    setPendingImageBlob(null);
    setForm(productToForm(p));
    setShowForm(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    const sub = enabledSubs.find((s) => String(s.id) === form.subcategoryId);
    const err = validateProductForm(form, sub, Boolean(editing));
    if (err) {
      showAlert('warning', 'Validation', err);
      return;
    }
    setSaving(true);
    try {
      const payload = buildProductPayload(form, Boolean(editing), sub);
      if (editing) {
        await updatePosProduct(editing.id, payload);
        showAlert('success', 'Updated', 'Product saved.');
      } else {
        const created = await createPosProduct(payload);
        if (pendingImageBlob) {
          try {
            await uploadPosProductImage(created.id, pendingImageBlob, 'product.jpg');
          } catch (imgErr) {
            showAlert(
              'warning',
              'Product created',
              `Product was saved but the image could not be uploaded: ${posProductImageErrorMessage(imgErr)}`
            );
            setPendingImageBlob(null);
            setShowForm(false);
            setEditing(null);
            await loadProducts();
            return;
          }
        }
        showAlert('success', 'Created', 'Product added.');
      }
      setPendingImageBlob(null);
      setShowForm(false);
      setEditing(null);
      await loadProducts();
    } catch (e) {
      showAlert('error', 'Save failed', posErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Alert isOpen={alert.isOpen} onClose={closeAlert} type={alert.type} title={alert.title} message={alert.message} />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark-gray">POS Products</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage gym products in enabled subcategories. For nutrients, add products under Packaged or Serving.
          </p>
        </div>
        {canManage && (
          <button type="button" onClick={startAdd} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
            Add product
          </button>
        )}
      </div>

      <PosPermissionGate allowed={canView}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <PosProductTypeTabs value={productType} onChange={setProductType} />
          <input
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Search name or SKU"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (setSearchApplied(search), setPage(1))}
          />
          <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => { setSearchApplied(search); setPage(1); }}>
            Search
          </button>
        </div>

        {showForm && canManage && (
          <form onSubmit={submit} className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold">{editing ? 'Edit product' : 'New product'}</h2>
            {enabledSubs.length === 0 ? (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                No POS categories enabled. Go to{' '}
                <Link href="/pos/setup" className="font-semibold underline">
                  POS Setup
                </Link>{' '}
                and enable subcategories.
              </div>
            ) : null}
            <PosProductForm
              form={form}
              setForm={setForm}
              subcategories={enabledSubs}
              productId={editing?.id}
              onPendingImageChange={setPendingImageBlob}
              onImageError={(message) => showAlert('error', 'Image', message)}
              onImageSuccess={(message) => showAlert('success', 'Image', message)}
              disabled={saving || enabledSubs.length === 0}
              isEdit={Boolean(editing)}
            />
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={saving || (!editing && enabledSubs.length === 0)}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setPendingImageBlob(null);
                }}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <Loading message="Loading products…" />
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">SKU</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Price</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Stock</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No products found.</td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-gray-500">{p.sku || '—'}</td>
                      <td className="px-4 py-3">{formatMoney(p.price)}</td>
                      <td className="px-4 py-3">
                        {p.trackInventory === false ? '—' : p.stockQuantity ?? 0}
                        {p.isLowStock && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Low stock</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!p.isActive && <span className="text-gray-500">Inactive</span>}
                        {p.subcategoryEnabled === false && (
                          <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">Subcategory off</span>
                        )}
                        {p.isActive && p.subcategoryEnabled !== false && (
                          <span className="text-emerald-700">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/pos/products/${p.id}`} className="mr-3 text-primary hover:underline">Inventory</Link>
                        {canManage && (
                          <button type="button" onClick={() => startEdit(p)} className="text-gray-600 hover:underline">Edit</button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
                <span className="text-gray-500">Page {pagination.page} of {pagination.totalPages}</span>
                <div className="flex gap-2">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40">Prev</button>
                  <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border px-2 py-1 disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </div>
        )}
      </PosPermissionGate>
    </>
  );
}

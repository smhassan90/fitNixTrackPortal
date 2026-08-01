'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Alert from '@/components/Alert';
import Loading from '@/components/Loading';
import PosAdjustStockModal from '@/components/pos/PosAdjustStockModal';
import PosPermissionGate from '@/components/pos/PosPermissionGate';
import PosRestockModal from '@/components/pos/PosRestockModal';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import {
  adjustStock,
  fetchPosProduct,
  fetchStockHistory,
  posErrorMessage,
  restockProduct,
} from '@/lib/pos/posApi';
import { resolveProductImageUrl } from '@/lib/pos/productImage';
import { POS_PERMISSION_KEYS } from '@/lib/pos/permissions';
import { formatMoney } from '@/lib/pos/utils';
import type { PosProduct, PosStockHistoryEntry } from '@/lib/pos/types';
import { formatDate } from '@/lib/dateUtils';

export default function PosProductDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { can } = useAuth();
  const canView = can(POS_PERMISSION_KEYS.catalogRead);
  const canInventory = can(POS_PERMISSION_KEYS.inventoryManage);
  const { alert, showAlert, closeAlert } = useAlert();

  const [product, setProduct] = useState<PosProduct | null>(null);
  const [history, setHistory] = useState<PosStockHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [restockOpen, setRestockOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [activeImageId, setActiveImageId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [p, h] = await Promise.all([fetchPosProduct(id), fetchStockHistory(id)]);
      setProduct(p);
      setHistory(h);
      const featured = p.images?.find((i) => i.isFeatured) ?? p.images?.[0];
      setActiveImageId(featured?.id ?? null);
    } catch (e) {
      showAlert('error', 'Could not load product', posErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id, showAlert]);

  useEffect(() => {
    if (canView && id) void load();
    else setLoading(false);
  }, [canView, id, load]);

  const gallery = useMemo(() => {
    if (!product) return [];
    if (product.images?.length) {
      return [...product.images].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    }
    if (product.imageUrl) {
      return [{ id: 0, url: product.imageUrl, isFeatured: true, sortOrder: 0 }];
    }
    return [];
  }, [product]);

  const activeImage = gallery.find((i) => i.id === activeImageId) ?? gallery[0] ?? null;
  const heroUrl = resolveProductImageUrl(activeImage?.url ?? product?.imageUrl);

  const trackInventory = product?.trackInventory !== false;

  return (
    <>
      <Alert isOpen={alert.isOpen} onClose={closeAlert} type={alert.type} title={alert.title} message={alert.message} />
      <Link href="/pos/products" className="text-sm text-primary hover:underline">
        ← Back to products
      </Link>
      <PosPermissionGate allowed={canView}>
        {loading || !product ? (
          <Loading message="Loading product…" />
        ) : (
          <div className="mt-4 space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                <div>
                  <div className="aspect-square overflow-hidden rounded-xl bg-gray-100">
                    {heroUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={heroUrl} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-gray-400">
                        No image
                      </div>
                    )}
                  </div>
                  {gallery.length > 1 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {gallery.map((img) => {
                        const src = resolveProductImageUrl(img.url);
                        const selected = (activeImage?.id ?? null) === img.id;
                        return (
                          <button
                            key={img.id}
                            type="button"
                            onClick={() => setActiveImageId(img.id)}
                            className={`relative h-14 w-14 overflow-hidden rounded-lg border-2 ${
                              selected ? 'border-primary' : 'border-transparent'
                            }`}
                          >
                            {src ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={src} alt="" className="h-full w-full object-cover" />
                            ) : null}
                            {img.isFeatured && (
                              <span className="absolute bottom-0 left-0 right-0 bg-primary/90 text-[8px] font-bold uppercase text-ink">
                                Featured
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <h1 className="text-xl font-bold text-dark-gray">{product.name}</h1>
                  <p className="mt-1 text-sm text-gray-500">
                    {product.productType} · {product.form ?? '—'}
                    {gallery.length > 0
                      ? ` · ${gallery.length} image${gallery.length === 1 ? '' : 's'}`
                      : ''}
                  </p>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <span className="text-gray-500">Price</span>
                      <p className="font-medium">{formatMoney(product.price)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Stock</span>
                      <p className="font-medium">
                        {trackInventory ? product.stockQuantity ?? 0 : 'Not tracked'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Low stock</span>
                      <p className="font-medium">{product.isLowStock ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                  {canInventory && trackInventory && (
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setRestockOpen(true)}
                        className="rounded-lg bg-primary px-3 py-1.5 text-sm text-white"
                      >
                        Restock
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustOpen(true)}
                        className="rounded-lg border px-3 py-1.5 text-sm"
                      >
                        Adjust stock
                      </button>
                    </div>
                  )}
                  {canInventory && !trackInventory && (
                    <p className="mt-3 text-xs text-gray-500">
                      Restock is disabled when inventory is not tracked.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white">
              <h2 className="border-b px-4 py-3 font-semibold">Stock history</h2>
              {history.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-500">No stock movements yet.</p>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left">Change</th>
                      <th className="px-4 py-2 text-left">After</th>
                      <th className="px-4 py-2 text-left">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td className="px-4 py-2">{formatDate(h.createdAt)}</td>
                        <td className="px-4 py-2">{h.changeType}</td>
                        <td className="px-4 py-2">
                          {h.quantityChange > 0 ? `+${h.quantityChange}` : h.quantityChange}
                        </td>
                        <td className="px-4 py-2">{h.stockAfter}</td>
                        <td className="px-4 py-2 text-gray-500">{h.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </PosPermissionGate>

      <PosRestockModal
        open={restockOpen}
        productName={product?.name ?? ''}
        onClose={() => setRestockOpen(false)}
        onConfirm={async (quantity, note) => {
          await restockProduct(id, quantity, note);
          showAlert('success', 'Restocked', `Added ${quantity} units.`);
          await load();
        }}
      />
      <PosAdjustStockModal
        open={adjustOpen}
        productName={product?.name ?? ''}
        currentStock={product?.stockQuantity ?? 0}
        onClose={() => setAdjustOpen(false)}
        onConfirm={async (stockQuantity, note) => {
          await adjustStock(id, stockQuantity, note);
          showAlert('success', 'Updated', 'Stock adjusted.');
          await load();
        }}
      />
    </>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@/components/Alert';
import Loading from '@/components/Loading';
import PosCatalogTree from '@/components/pos/PosCatalogTree';
import PosProductTypeTabs from '@/components/pos/PosProductTypeTabs';
import { useIsPlatformSuperAdmin } from '@/contexts/PlatformAuthContext';
import { useAlert } from '@/hooks/useAlert';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import {
  createPlatformPosCategory,
  createPlatformPosSubcategory,
  deletePlatformPosCategory,
  deletePlatformPosSubcategory,
  fetchPlatformPosCatalog,
  updatePlatformPosCategory,
  updatePlatformPosSubcategory,
} from '@/lib/platform/posApi';
import type { NutrientForm, PosCategory, PosProductType, PosSubcategory } from '@/lib/pos/types';
import Link from 'next/link';

export default function PlatformPosCatalogPage() {
  const isSuper = useIsPlatformSuperAdmin();
  const { alert, showAlert, closeAlert } = useAlert();
  const [productType, setProductType] = useState<PosProductType>('NUTRIENT');
  const [categories, setCategories] = useState<PosCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [catName, setCatName] = useState('');
  const [subForm, setSubForm] = useState<{ categoryId: number; name: string; allowedForms: NutrientForm[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPlatformPosCatalog();
      setCategories(data);
    } catch (e) {
      showAlert('error', 'Load failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    if (isSuper) void load();
    else setLoading(false);
  }, [isSuper, load]);

  const filtered = useMemo(
    () => categories.filter((c) => c.productType === productType),
    [categories, productType]
  );

  if (!isSuper) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="font-semibold text-amber-900">Super Admin only</p>
        <Link href="/platform" className="mt-2 inline-block text-sm text-primary">Back to platform home</Link>
      </div>
    );
  }

  const addCategory = async () => {
    if (!catName.trim()) return;
    try {
      await createPlatformPosCategory({ name: catName.trim(), productType });
      setCatName('');
      await load();
      showAlert('success', 'Created', 'Category added.');
    } catch (e) {
      showAlert('error', 'Failed', mapPlatformErrorToUserMessage(e));
    }
  };

  const addSubcategory = async () => {
    if (!subForm?.name.trim()) return;
    try {
      await createPlatformPosSubcategory({
        categoryId: subForm.categoryId,
        name: subForm.name.trim(),
        allowedForms: productType === 'NUTRIENT' ? subForm.allowedForms : undefined,
      });
      setSubForm(null);
      await load();
      showAlert('success', 'Created', 'Subcategory added.');
    } catch (e) {
      showAlert('error', 'Failed', mapPlatformErrorToUserMessage(e));
    }
  };

  return (
    <>
      <Alert isOpen={alert.isOpen} onClose={closeAlert} type={alert.type} title={alert.title} message={alert.message} />
      <h1 className="mb-2 text-2xl font-bold text-dark-gray">POS Catalog</h1>
      <p className="mb-4 text-sm text-gray-500">Manage platform-wide POS categories and subcategories.</p>
      <PosProductTypeTabs value={productType} onChange={setProductType} />

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          className="rounded-lg border px-3 py-2 text-sm"
          placeholder="New category name"
          value={catName}
          onChange={(e) => setCatName(e.target.value)}
        />
        <button type="button" onClick={addCategory} className="rounded-lg bg-primary px-4 py-2 text-sm text-white">Add category</button>
      </div>

      {subForm && (
        <div className="mt-4 rounded-xl border bg-white p-4">
          <h3 className="font-semibold">New subcategory</h3>
          <input className="mt-2 w-full rounded border px-3 py-2 text-sm" value={subForm.name} onChange={(e) => setSubForm({ ...subForm, name: e.target.value })} />
          {productType === 'NUTRIENT' && (
            <div className="mt-2 flex gap-4 text-sm">
              {(['PACKAGED', 'SERVING'] as NutrientForm[]).map((f) => (
                <label key={f} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={subForm.allowedForms.includes(f)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...subForm.allowedForms, f]
                        : subForm.allowedForms.filter((x) => x !== f);
                      setSubForm({ ...subForm, allowedForms: next });
                    }}
                  />
                  {f}
                </label>
              ))}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={addSubcategory} className="rounded bg-primary px-3 py-1.5 text-sm text-white">Save</button>
            <button type="button" onClick={() => setSubForm(null)} className="rounded border px-3 py-1.5 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <Loading message="Loading catalog…" />
        ) : (
          <PosCatalogTree
            categories={filtered}
            onAddCategory={() => setCatName('')}
            onAddSubcategory={(cat) => setSubForm({ categoryId: cat.id, name: '', allowedForms: ['PACKAGED', 'SERVING'] })}
            onEditCategory={async (cat) => {
              const name = window.prompt('Category name', cat.name);
              if (!name?.trim()) return;
              try {
                await updatePlatformPosCategory(cat.id, { name: name.trim() });
                await load();
              } catch (e) {
                showAlert('error', 'Update failed', mapPlatformErrorToUserMessage(e));
              }
            }}
            onDeleteCategory={async (cat) => {
              if (!window.confirm(`Delete category "${cat.name}"?`)) return;
              try {
                await deletePlatformPosCategory(cat.id);
                await load();
              } catch (e) {
                showAlert('error', 'Delete failed', mapPlatformErrorToUserMessage(e));
              }
            }}
            onEditSubcategory={async (sub) => {
              const name = window.prompt('Subcategory name', sub.name);
              if (!name?.trim()) return;
              try {
                await updatePlatformPosSubcategory(sub.id, { name: name.trim(), allowedForms: sub.allowedForms });
                await load();
              } catch (e) {
                showAlert('error', 'Update failed', mapPlatformErrorToUserMessage(e));
              }
            }}
            onDeleteSubcategory={async (sub) => {
              if (!window.confirm(`Delete subcategory "${sub.name}"?`)) return;
              try {
                await deletePlatformPosSubcategory(sub.id);
                await load();
              } catch (e) {
                showAlert('error', 'Delete failed', mapPlatformErrorToUserMessage(e));
              }
            }}
          />
        )}
      </div>
    </>
  );
}

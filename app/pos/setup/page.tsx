'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@/components/Alert';
import Loading from '@/components/Loading';
import PosCatalogTree from '@/components/pos/PosCatalogTree';
import PosPermissionGate from '@/components/pos/PosPermissionGate';
import PosProductTypeTabs from '@/components/pos/PosProductTypeTabs';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import { fetchPosCatalog, posErrorMessage, saveGymSubcategories } from '@/lib/pos/posApi';
import { POS_PERMISSION_KEYS } from '@/lib/pos/permissions';
import type { PosProductType } from '@/lib/pos/types';

export default function PosSetupPage() {
  const { can } = useAuth();
  const canManage = can(POS_PERMISSION_KEYS.productsManage);
  const { alert, showAlert, closeAlert } = useAlert();
  const [productType, setProductType] = useState<PosProductType>('NUTRIENT');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof fetchPosCatalog>>>([]);
  const [enabledIds, setEnabledIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPosCatalog(true);
      setCategories(data);
      const enabled = new Set<number>();
      for (const cat of data) {
        for (const sub of cat.subcategories ?? []) {
          if (sub.enabledForGym) enabled.add(sub.id);
        }
      }
      setEnabledIds(enabled);
    } catch (e) {
      showAlert('error', 'Could not load catalog', posErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    if (canManage) void load();
    else setLoading(false);
  }, [canManage, load]);

  const filtered = useMemo(
    () => categories.filter((c) => c.productType === productType),
    [categories, productType]
  );

  const toggleEnable = (subcategoryId: number, enabled: boolean) => {
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (enabled) next.add(subcategoryId);
      else next.delete(subcategoryId);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveGymSubcategories(Array.from(enabledIds));
      showAlert('success', 'Saved', 'Enabled subcategories updated.');
      await load();
    } catch (e) {
      showAlert('error', 'Save failed', posErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Alert isOpen={alert.isOpen} onClose={closeAlert} type={alert.type} title={alert.title} message={alert.message} />
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-dark-gray">POS Setup</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enable platform subcategories for your gym. Categories are managed by FitNix (read-only here).
        </p>
      </div>
      <PosPermissionGate allowed={canManage} message="You need Manage POS products permission to configure subcategories.">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <PosProductTypeTabs value={productType} onChange={setProductType} />
          <button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save enabled subcategories'}
          </button>
        </div>
        {loading ? (
          <Loading message="Loading catalog…" />
        ) : (
          <PosCatalogTree
            categories={filtered}
            readOnly
            showEnableToggle
            enabledIds={enabledIds}
            onToggleEnable={toggleEnable}
          />
        )}
      </PosPermissionGate>
    </>
  );
}

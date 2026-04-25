'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createPlatformBillingPlan,
  createPlatformCity,
  createPlatformCountry,
  deletePlatformBillingPlan,
  deletePlatformCity,
  deletePlatformCountry,
  listPlatformBillingPlans,
  listPlatformCountries,
  listPlatformCountryCities,
  patchPlatformBillingPlan,
  patchPlatformCity,
  patchPlatformCountry,
} from '@/lib/platform/platformApi';
import { useIsPlatformSuperAdmin } from '@/contexts/PlatformAuthContext';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import Alert from '@/components/Alert';
import { useAlert } from '@/hooks/useAlert';
import Loading from '@/components/Loading';

type PlanRow = {
  id: string;
  name: string;
  code: string;
  amount: string;
  currency: string;
  billingCycle: string;
  isActive: boolean;
  sortOrder: number;
};

type CountryRow = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
};

type CityRow = {
  id: string;
  countryId: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
};

function asObj(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function toPlanRow(entry: unknown): PlanRow | null {
  const o = asObj(entry);
  if (!o) return null;
  const id = String(o.id ?? o.planId ?? '').trim();
  if (!id) return null;
  return {
    id,
    name: String(o.name ?? o.planName ?? '').trim(),
    code: String(o.code ?? '').trim(),
    amount: String(o.amount ?? o.price ?? ''),
    currency: String(o.currency ?? 'PKR').toUpperCase(),
    billingCycle: String(o.billingCycle ?? o.cycle ?? 'MONTHLY').toUpperCase(),
    isActive: o.isActive !== false && String(o.status ?? '').toUpperCase() !== 'INACTIVE',
    sortOrder: Number(o.sortOrder ?? 0) || 0,
  };
}

function normalizePlans(payload: unknown): PlanRow[] {
  const root = asObj(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.plans)
      ? root.plans
      : Array.isArray(root?.items)
        ? root.items
        : [];
  return list.map(toPlanRow).filter((x): x is PlanRow => Boolean(x));
}

function toCountryRow(entry: unknown): CountryRow | null {
  const o = asObj(entry);
  if (!o) return null;
  const id = String(o.id ?? o.countryId ?? '').trim();
  if (!id) return null;
  return {
    id,
    name: String(o.name ?? o.country ?? '').trim(),
    code: String(o.code ?? '').trim(),
    isActive: o.isActive !== false,
    sortOrder: Number(o.sortOrder ?? 0) || 0,
  };
}

function normalizeCountries(payload: unknown): CountryRow[] {
  const root = asObj(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.countries)
      ? root.countries
      : Array.isArray(root?.items)
        ? root.items
        : [];
  return list.map(toCountryRow).filter((x): x is CountryRow => Boolean(x));
}

function toCityRow(entry: unknown, defaultCountryId: string): CityRow | null {
  const o = asObj(entry);
  if (!o) return null;
  const id = String(o.id ?? o.cityId ?? '').trim();
  if (!id) return null;
  const countryRaw = o.countryId ?? asObj(o.country)?.id ?? defaultCountryId;
  return {
    id,
    countryId: String(countryRaw ?? defaultCountryId),
    name: String(o.name ?? o.city ?? '').trim(),
    isActive: o.isActive !== false,
    sortOrder: Number(o.sortOrder ?? 0) || 0,
  };
}

function normalizeCities(payload: unknown, countryId: string): CityRow[] {
  const root = asObj(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.cities)
      ? root.cities
      : Array.isArray(root?.items)
        ? root.items
        : [];
  return list.map((x) => toCityRow(x, countryId)).filter((x): x is CityRow => Boolean(x));
}

export default function PlatformCatalogPage() {
  const isSuper = useIsPlatformSuperAdmin();
  const { alert, showAlert, closeAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState('');
  const [cities, setCities] = useState<CityRow[]>([]);

  const [newPlan, setNewPlan] = useState({
    name: '',
    code: '',
    amount: '',
    currency: 'PKR',
    billingCycle: 'MONTHLY',
    sortOrder: '0',
  });
  const [newCountry, setNewCountry] = useState({ name: '', code: '', sortOrder: '0' });
  const [newCity, setNewCity] = useState({ name: '', sortOrder: '0' });

  const [editingPlanId, setEditingPlanId] = useState('');
  const [editingCountryId, setEditingCountryId] = useState('');
  const [editingCityId, setEditingCityId] = useState('');

  const selectedCountry = useMemo(
    () => countries.find((c) => c.id === selectedCountryId) ?? null,
    [countries, selectedCountryId]
  );

  const loadCore = useCallback(async () => {
    setLoading(true);
    try {
      const [plansData, countriesData] = await Promise.all([
        listPlatformBillingPlans({}),
        listPlatformCountries(),
      ]);
      const nextPlans = normalizePlans(plansData);
      const nextCountries = normalizeCountries(countriesData);
      setPlans(nextPlans);
      setCountries(nextCountries);
      if (nextCountries.length > 0) {
        setSelectedCountryId((prev) =>
          prev && nextCountries.some((c) => c.id === prev) ? prev : nextCountries[0].id
        );
      } else {
        setSelectedCountryId('');
      }
    } catch (e) {
      showAlert('error', 'Load failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  const loadCities = useCallback(
    async (countryId: string) => {
      if (!countryId) {
        setCities([]);
        return;
      }
      try {
        const data = await listPlatformCountryCities(countryId);
        setCities(normalizeCities(data, countryId));
      } catch (e) {
        setCities([]);
        showAlert('error', 'Cities failed', mapPlatformErrorToUserMessage(e));
      }
    },
    [showAlert]
  );

  useEffect(() => {
    loadCore();
  }, [loadCore]);

  useEffect(() => {
    loadCities(selectedCountryId);
  }, [selectedCountryId, loadCities]);

  const guardSuper = () => {
    if (!isSuper) {
      showAlert('error', 'Forbidden', 'Only super admins can change catalog data.');
      return false;
    }
    return true;
  };

  const addPlan = async () => {
    if (!guardSuper()) return;
    setSaving(true);
    try {
      await createPlatformBillingPlan({
        name: newPlan.name.trim(),
        code: newPlan.code.trim().toUpperCase(),
        amount: Number(newPlan.amount),
        currency: newPlan.currency.trim().toUpperCase(),
        billingCycle: newPlan.billingCycle,
        sortOrder: Number(newPlan.sortOrder) || 0,
        isActive: true,
      });
      setNewPlan({ name: '', code: '', amount: '', currency: 'PKR', billingCycle: 'MONTHLY', sortOrder: '0' });
      await loadCore();
      showAlert('success', 'Package added', 'Billing package created successfully.');
    } catch (e) {
      showAlert('error', 'Create failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const updatePlan = async (row: PlanRow) => {
    if (!guardSuper()) return;
    setSaving(true);
    try {
      await patchPlatformBillingPlan(row.id, {
        name: row.name.trim(),
        code: row.code.trim().toUpperCase(),
        amount: Number(row.amount),
        currency: row.currency.trim().toUpperCase(),
        billingCycle: row.billingCycle,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
      });
      setEditingPlanId('');
      showAlert('success', 'Package updated', 'Billing package updated successfully.');
    } catch (e) {
      showAlert('error', 'Update failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const removePlan = async (id: string) => {
    if (!guardSuper()) return;
    if (!window.confirm('Delete this package?')) return;
    setSaving(true);
    try {
      await deletePlatformBillingPlan(id);
      setPlans((prev) => prev.filter((x) => x.id !== id));
      showAlert('success', 'Package deleted', 'Billing package removed.');
    } catch (e) {
      showAlert('error', 'Delete failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const addCountry = async () => {
    if (!guardSuper()) return;
    setSaving(true);
    try {
      await createPlatformCountry({
        name: newCountry.name.trim(),
        code: newCountry.code.trim().toUpperCase() || undefined,
        sortOrder: Number(newCountry.sortOrder) || 0,
        isActive: true,
      });
      setNewCountry({ name: '', code: '', sortOrder: '0' });
      await loadCore();
      showAlert('success', 'Country added', 'Country created successfully.');
    } catch (e) {
      showAlert('error', 'Create failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const updateCountry = async (row: CountryRow) => {
    if (!guardSuper()) return;
    setSaving(true);
    try {
      await patchPlatformCountry(row.id, {
        name: row.name.trim(),
        code: row.code.trim().toUpperCase() || undefined,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
      });
      setEditingCountryId('');
      showAlert('success', 'Country updated', 'Country updated successfully.');
    } catch (e) {
      showAlert('error', 'Update failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const removeCountry = async (id: string) => {
    if (!guardSuper()) return;
    if (!window.confirm('Delete this country?')) return;
    setSaving(true);
    try {
      await deletePlatformCountry(id);
      setCountries((prev) => prev.filter((x) => x.id !== id));
      if (selectedCountryId === id) setSelectedCountryId('');
      showAlert('success', 'Country deleted', 'Country removed.');
    } catch (e) {
      showAlert('error', 'Delete failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const addCity = async () => {
    if (!guardSuper()) return;
    if (!selectedCountryId) {
      showAlert('error', 'Country required', 'Select a country before adding city.');
      return;
    }
    setSaving(true);
    try {
      await createPlatformCity({
        countryId: selectedCountryId,
        name: newCity.name.trim(),
        sortOrder: Number(newCity.sortOrder) || 0,
        isActive: true,
      });
      setNewCity({ name: '', sortOrder: '0' });
      await loadCities(selectedCountryId);
      showAlert('success', 'City added', 'City created successfully.');
    } catch (e) {
      showAlert('error', 'Create failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const updateCity = async (row: CityRow) => {
    if (!guardSuper()) return;
    setSaving(true);
    try {
      await patchPlatformCity(row.id, {
        name: row.name.trim(),
        sortOrder: row.sortOrder,
        isActive: row.isActive,
      });
      setEditingCityId('');
      showAlert('success', 'City updated', 'City updated successfully.');
    } catch (e) {
      showAlert('error', 'Update failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const removeCity = async (id: string) => {
    if (!guardSuper()) return;
    if (!window.confirm('Delete this city?')) return;
    setSaving(true);
    try {
      await deletePlatformCity(id);
      setCities((prev) => prev.filter((x) => x.id !== id));
      showAlert('success', 'City deleted', 'City removed.');
    } catch (e) {
      showAlert('error', 'Delete failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loading message="Loading catalog…" fullScreen size="md" />;
  }

  return (
    <>
      <Alert
        isOpen={alert.isOpen}
        onClose={closeAlert}
        type={alert.type}
        title={alert.title}
        message={alert.message}
      />
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-dark-gray">Catalog</h1>
          <p className="text-sm text-dark-gray-light mt-1">
            Manage billing packages and location catalogs (countries and cities).
          </p>
        </div>

        <section className="rounded-xl bg-white p-4 shadow border border-light-gray-dark">
          <h2 className="font-semibold text-dark-gray">Billing packages</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-6">
            <input className="rounded border px-2 py-1.5 text-sm" placeholder="Name" value={newPlan.name} onChange={(e) => setNewPlan((p) => ({ ...p, name: e.target.value }))} />
            <input className="rounded border px-2 py-1.5 text-sm" placeholder="Code" value={newPlan.code} onChange={(e) => setNewPlan((p) => ({ ...p, code: e.target.value }))} />
            <input className="rounded border px-2 py-1.5 text-sm" placeholder="Amount" value={newPlan.amount} onChange={(e) => setNewPlan((p) => ({ ...p, amount: e.target.value }))} />
            <input className="rounded border px-2 py-1.5 text-sm" placeholder="Currency" value={newPlan.currency} onChange={(e) => setNewPlan((p) => ({ ...p, currency: e.target.value }))} />
            <select className="rounded border px-2 py-1.5 text-sm bg-white" value={newPlan.billingCycle} onChange={(e) => setNewPlan((p) => ({ ...p, billingCycle: e.target.value }))}>
              <option value="MONTHLY">MONTHLY</option>
              <option value="QUARTERLY">QUARTERLY</option>
              <option value="YEARLY">YEARLY</option>
            </select>
            <div className="flex gap-2">
              <input className="w-20 rounded border px-2 py-1.5 text-sm" placeholder="Sort" value={newPlan.sortOrder} onChange={(e) => setNewPlan((p) => ({ ...p, sortOrder: e.target.value }))} />
              <button type="button" onClick={addPlan} disabled={saving || !isSuper} className="rounded bg-primary px-3 py-1.5 text-xs text-white disabled:opacity-40">
                Add
              </button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-light-gray text-dark-gray-light">
                <tr>
                  <th className="px-2 py-2 text-left">Name</th><th className="px-2 py-2 text-left">Code</th><th className="px-2 py-2 text-left">Amount</th><th className="px-2 py-2 text-left">Cycle</th><th className="px-2 py-2 text-left">Active</th><th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((row, idx) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-2 py-2"><input className="w-full rounded border px-2 py-1" value={row.name} onChange={(e) => setPlans((p) => p.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} /></td>
                    <td className="px-2 py-2"><input className="w-full rounded border px-2 py-1" value={row.code} onChange={(e) => setPlans((p) => p.map((x, i) => i === idx ? { ...x, code: e.target.value } : x))} /></td>
                    <td className="px-2 py-2"><input className="w-full rounded border px-2 py-1" value={row.amount} onChange={(e) => setPlans((p) => p.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x))} /></td>
                    <td className="px-2 py-2"><input className="w-full rounded border px-2 py-1" value={row.billingCycle} onChange={(e) => setPlans((p) => p.map((x, i) => i === idx ? { ...x, billingCycle: e.target.value.toUpperCase() } : x))} /></td>
                    <td className="px-2 py-2"><input type="checkbox" checked={row.isActive} onChange={(e) => setPlans((p) => p.map((x, i) => i === idx ? { ...x, isActive: e.target.checked } : x))} /></td>
                    <td className="px-2 py-2 text-right space-x-2">
                      <button type="button" onClick={() => { setEditingPlanId(row.id); void updatePlan(row); }} disabled={saving || !isSuper} className="text-primary hover:underline disabled:opacity-40">Save</button>
                      <button type="button" onClick={() => void removePlan(row.id)} disabled={saving || !isSuper} className="text-error hover:underline disabled:opacity-40">Delete</button>
                    </td>
                  </tr>
                ))}
                {plans.length === 0 && <tr><td colSpan={6} className="px-2 py-4 text-center text-dark-gray-light">No packages found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl bg-white p-4 shadow border border-light-gray-dark">
          <h2 className="font-semibold text-dark-gray">Countries</h2>
          <div className="mt-3 flex gap-2">
            <input className="rounded border px-2 py-1.5 text-sm" placeholder="Country name" value={newCountry.name} onChange={(e) => setNewCountry((c) => ({ ...c, name: e.target.value }))} />
            <input className="rounded border px-2 py-1.5 text-sm" placeholder="Code" value={newCountry.code} onChange={(e) => setNewCountry((c) => ({ ...c, code: e.target.value }))} />
            <input className="w-24 rounded border px-2 py-1.5 text-sm" placeholder="Sort" value={newCountry.sortOrder} onChange={(e) => setNewCountry((c) => ({ ...c, sortOrder: e.target.value }))} />
            <button type="button" onClick={addCountry} disabled={saving || !isSuper} className="rounded bg-primary px-3 py-1.5 text-xs text-white disabled:opacity-40">Add</button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-light-gray text-dark-gray-light"><tr><th className="px-2 py-2 text-left">Name</th><th className="px-2 py-2 text-left">Code</th><th className="px-2 py-2 text-left">Active</th><th className="px-2 py-2 text-right">Actions</th></tr></thead>
              <tbody>
                {countries.map((row, idx) => (
                  <tr key={row.id} className={`border-t ${row.id === selectedCountryId ? 'bg-primary/5' : ''}`}>
                    <td className="px-2 py-2"><button type="button" onClick={() => setSelectedCountryId(row.id)} className="text-left hover:underline">{row.name || '—'}</button></td>
                    <td className="px-2 py-2"><input className="w-full rounded border px-2 py-1" value={row.code} onChange={(e) => setCountries((p) => p.map((x, i) => i === idx ? { ...x, code: e.target.value } : x))} /></td>
                    <td className="px-2 py-2"><input type="checkbox" checked={row.isActive} onChange={(e) => setCountries((p) => p.map((x, i) => i === idx ? { ...x, isActive: e.target.checked } : x))} /></td>
                    <td className="px-2 py-2 text-right space-x-2">
                      <button type="button" onClick={() => { setEditingCountryId(row.id); void updateCountry(row); }} disabled={saving || !isSuper} className="text-primary hover:underline disabled:opacity-40">Save</button>
                      <button type="button" onClick={() => void removeCountry(row.id)} disabled={saving || !isSuper} className="text-error hover:underline disabled:opacity-40">Delete</button>
                    </td>
                  </tr>
                ))}
                {countries.length === 0 && <tr><td colSpan={4} className="px-2 py-4 text-center text-dark-gray-light">No countries found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl bg-white p-4 shadow border border-light-gray-dark">
          <h2 className="font-semibold text-dark-gray">Cities {selectedCountry ? `· ${selectedCountry.name}` : ''}</h2>
          <div className="mt-3 flex gap-2">
            <select className="rounded border px-2 py-1.5 text-sm bg-white" value={selectedCountryId} onChange={(e) => setSelectedCountryId(e.target.value)}>
              <option value="">Select country</option>
              {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input className="rounded border px-2 py-1.5 text-sm" placeholder="City name" value={newCity.name} onChange={(e) => setNewCity((c) => ({ ...c, name: e.target.value }))} />
            <input className="w-24 rounded border px-2 py-1.5 text-sm" placeholder="Sort" value={newCity.sortOrder} onChange={(e) => setNewCity((c) => ({ ...c, sortOrder: e.target.value }))} />
            <button type="button" onClick={addCity} disabled={saving || !isSuper || !selectedCountryId} className="rounded bg-primary px-3 py-1.5 text-xs text-white disabled:opacity-40">Add</button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-light-gray text-dark-gray-light"><tr><th className="px-2 py-2 text-left">Name</th><th className="px-2 py-2 text-left">Active</th><th className="px-2 py-2 text-right">Actions</th></tr></thead>
              <tbody>
                {cities.map((row, idx) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-2 py-2"><input className="w-full rounded border px-2 py-1" value={row.name} onChange={(e) => setCities((p) => p.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} /></td>
                    <td className="px-2 py-2"><input type="checkbox" checked={row.isActive} onChange={(e) => setCities((p) => p.map((x, i) => i === idx ? { ...x, isActive: e.target.checked } : x))} /></td>
                    <td className="px-2 py-2 text-right space-x-2">
                      <button type="button" onClick={() => { setEditingCityId(row.id); void updateCity(row); }} disabled={saving || !isSuper} className="text-primary hover:underline disabled:opacity-40">Save</button>
                      <button type="button" onClick={() => void removeCity(row.id)} disabled={saving || !isSuper} className="text-error hover:underline disabled:opacity-40">Delete</button>
                    </td>
                  </tr>
                ))}
                {cities.length === 0 && <tr><td colSpan={3} className="px-2 py-4 text-center text-dark-gray-light">No cities found for this country.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {(editingPlanId || editingCountryId || editingCityId) && (
          <p className="text-xs text-dark-gray-light">Changes are applied per row using Save buttons.</p>
        )}
      </div>
    </>
  );
}

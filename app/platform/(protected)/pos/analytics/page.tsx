'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Alert from '@/components/Alert';
import Loading from '@/components/Loading';
import { useIsPlatformSuperAdmin } from '@/contexts/PlatformAuthContext';
import { useAlert } from '@/hooks/useAlert';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import {
  comparePlatformGymsByCategory,
  fetchPlatformPosAnalytics,
  listPlatformGymsForPos,
} from '@/lib/platform/posApi';
import type { PosAnalyticsRow, PosProductType } from '@/lib/pos/types';
import { formatMoney } from '@/lib/pos/utils';

export default function PlatformPosAnalyticsPage() {
  const isSuper = useIsPlatformSuperAdmin();
  const { alert, showAlert, closeAlert } = useAlert();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [gymId, setGymId] = useState('');
  const [productType, setProductType] = useState<PosProductType | ''>('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [groupBy, setGroupBy] = useState<'day' | 'gym' | 'category' | 'subcategory' | 'product'>('day');
  const [rows, setRows] = useState<PosAnalyticsRow[]>([]);
  const [compareRows, setCompareRows] = useState<PosAnalyticsRow[]>([]);
  const [gyms, setGyms] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { groupBy };
      if (from) params.from = from;
      if (to) params.to = to;
      if (gymId) params.gymId = gymId;
      if (productType) params.productType = productType;
      if (categoryId) params.categoryId = categoryId;
      if (subcategoryId) params.subcategoryId = subcategoryId;
      const data = await fetchPlatformPosAnalytics(params);
      setRows(data);
      if (categoryId) {
        const cmp = await comparePlatformGymsByCategory(categoryId, { from, to });
        setCompareRows(cmp);
      } else {
        setCompareRows([]);
      }
    } catch (e) {
      showAlert('error', 'Load failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setLoading(false);
    }
  }, [from, to, gymId, productType, categoryId, subcategoryId, groupBy, showAlert]);

  useEffect(() => {
    if (!isSuper) {
      setLoading(false);
      return;
    }
    void listPlatformGymsForPos().then(setGyms).catch(() => setGyms([]));
  }, [isSuper]);

  useEffect(() => {
    if (isSuper) void load();
  }, [isSuper, load]);

  if (!isSuper) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="font-semibold text-amber-900">Super Admin only</p>
        <Link href="/platform" className="mt-2 inline-block text-sm text-primary">Back to platform home</Link>
      </div>
    );
  }

  const chartData = rows.map((r) => ({ name: r.label, revenue: r.revenue, sales: r.saleCount }));

  return (
    <>
      <Alert isOpen={alert.isOpen} onClose={closeAlert} type={alert.type} title={alert.title} message={alert.message} />
      <h1 className="mb-2 text-2xl font-bold text-dark-gray">POS Analytics</h1>
      <p className="mb-4 text-sm text-gray-500">Cross-gym POS performance and trends.</p>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input type="date" className="rounded border px-3 py-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="rounded border px-3 py-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
        <select className="rounded border px-3 py-2 text-sm" value={gymId} onChange={(e) => setGymId(e.target.value)}>
          <option value="">All gyms</option>
          {gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="rounded border px-3 py-2 text-sm" value={groupBy} onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}>
          <option value="day">By day</option>
          <option value="gym">By gym</option>
          <option value="category">By category</option>
          <option value="subcategory">By subcategory</option>
          <option value="product">By product</option>
        </select>
        <select className="rounded border px-3 py-2 text-sm" value={productType} onChange={(e) => setProductType(e.target.value as PosProductType | '')}>
          <option value="">All types</option>
          <option value="NUTRIENT">Nutrients</option>
          <option value="ACCESSORY">Accessories</option>
        </select>
        <input className="rounded border px-3 py-2 text-sm" placeholder="Category ID" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} />
        <input className="rounded border px-3 py-2 text-sm" placeholder="Subcategory ID" value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)} />
        <button type="button" onClick={load} className="rounded-lg bg-primary px-4 py-2 text-sm text-white">Apply filters</button>
      </div>

      {loading ? (
        <Loading message="Loading analytics…" />
      ) : (
        <>
          <div className="mb-6 h-72 rounded-xl border bg-white p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatMoney(v)} />
                <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-hidden rounded-xl border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">Label</th>
                  <th className="px-4 py-3 text-right">Sales</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">No data.</td></tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.key}>
                      <td className="px-4 py-3">{r.label}</td>
                      <td className="px-4 py-3 text-right">{r.saleCount}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(r.revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {compareRows.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 font-semibold">Gym comparison (category {categoryId})</h2>
              <div className="overflow-hidden rounded-xl border bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left">Gym</th>
                      <th className="px-4 py-3 text-right">Sales</th>
                      <th className="px-4 py-3 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {compareRows.map((r) => (
                      <tr key={r.key}>
                        <td className="px-4 py-3">{r.label}</td>
                        <td className="px-4 py-3 text-right">{r.saleCount}</td>
                        <td className="px-4 py-3 text-right">{formatMoney(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

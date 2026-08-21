'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  ExpenseCategory,
  ExpenseEntry,
  ExpensePaymentMethod,
} from '@/lib/expensesApi';

type FormState = {
  categoryId: string;
  amount: string;
  spentAt: string;
  paymentMethod: '' | ExpensePaymentMethod;
  notes: string;
};

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function entryToForm(entry: ExpenseEntry | null): FormState {
  if (!entry) {
    return {
      categoryId: '',
      amount: '',
      spentAt: todayYmd(),
      paymentMethod: '',
      notes: '',
    };
  }
  return {
    categoryId: String(entry.categoryId),
    amount: String(entry.amount),
    spentAt: (entry.spentAt || '').slice(0, 10),
    paymentMethod: entry.paymentMethod ?? '',
    notes: entry.notes ?? '',
  };
}

export default function ExpenseEntryDialog({
  open,
  entry,
  activeCategories,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  entry: ExpenseEntry | null;
  activeCategories: ExpenseCategory[];
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    categoryId: number;
    amount: number;
    spentAt: string;
    paymentMethod: ExpensePaymentMethod | null;
    notes: string | null;
  }) => Promise<void> | void;
}) {
  const [form, setForm] = useState<FormState>(() => entryToForm(entry));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const next = entryToForm(entry);
      if (!next.categoryId && activeCategories.length === 1) {
        next.categoryId = String(activeCategories[0].id);
      }
      setForm(next);
      setError(null);
    }
  }, [open, entry, activeCategories]);

  const options = useMemo(() => {
    const list = [...activeCategories];
    if (entry?.category && !list.some((c) => c.id === entry.categoryId)) {
      list.unshift({
        id: entry.category.id,
        gymId: entry.gymId,
        name: `${entry.category.name} (inactive)`,
        kind: entry.category.kind,
        isRecurring: false,
        defaultAmount: null,
        isActive: false,
        sortOrder: 0,
        deletedAt: null,
        createdAt: '',
        updatedAt: '',
      });
    }
    return list;
  }, [activeCategories, entry]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const categoryId = Number(form.categoryId);
    const amount = Number(form.amount);
    const spentAt = form.spentAt.trim();
    if (!categoryId) {
      setError('Select an expense head.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Amount must be greater than 0.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(spentAt)) {
      setError('Enter a valid date.');
      return;
    }
    if (form.notes.length > 500) {
      setError('Notes cannot exceed 500 characters.');
      return;
    }
    setError(null);
    await onSubmit({
      categoryId,
      amount,
      spentAt,
      paymentMethod: form.paymentMethod || null,
      notes: form.notes.trim() || null,
    });
  };

  const applyDefaultAmount = (categoryId: string) => {
    const cat = activeCategories.find((c) => String(c.id) === categoryId);
    if (cat?.defaultAmount != null && cat.defaultAmount > 0 && !form.amount) {
      setForm((prev) => ({ ...prev, categoryId, amount: String(cat.defaultAmount) }));
      return;
    }
    setForm((prev) => ({ ...prev, categoryId }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      <div className="absolute inset-0 bg-black/30 pointer-events-auto" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl border-2 border-gray-200 bg-white p-6 shadow-2xl pointer-events-auto">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold text-dark-gray">{entry ? 'Edit expense' : 'Add expense'}</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close">
            ✕
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Head *</label>
            <select
              required
              value={form.categoryId}
              onChange={(e) => applyDefaultAmount(e.target.value)}
              className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-primary"
            >
              <option value="">Select head</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {activeCategories.length === 0 && (
              <p className="mt-1 text-xs text-amber-800">No active expense heads. Add a head before posting expenses.</p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Amount (PKR) *</label>
              <input
                type="number"
                min={0.01}
                step="0.01"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Date *</label>
              <input
                type="date"
                required
                value={form.spentAt}
                onChange={(e) => setForm({ ...form, spentAt: e.target.value })}
                className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Payment method</label>
            <select
              value={form.paymentMethod}
              onChange={(e) =>
                setForm({ ...form, paymentMethod: e.target.value as FormState['paymentMethod'] })
              }
              className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-primary"
            >
              <option value="">—</option>
              <option value="CASH">Cash</option>
              <option value="ONLINE">Online</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Notes</label>
            <textarea
              rows={3}
              maxLength={500}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-gray-500">{form.notes.length}/500</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={submitting || (!entry && activeCategories.length === 0)}
              className="flex-1 rounded-lg bg-primary py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {submitting ? 'Saving…' : entry ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-gray-200 py-2 font-medium text-dark-gray hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

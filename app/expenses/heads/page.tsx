'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import Alert from '@/components/Alert';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import Layout from '@/components/Layout';
import { FilterBarSkeleton, Skeleton, TableSkeleton } from '@/components/Skeleton';
import ExpenseKindBadge from '@/components/expenses/ExpenseKindBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import { EXPENSE_PERMISSION_KEYS } from '@/lib/expensePermissions';
import { notifyExpenseChanged } from '@/lib/expenseEvents';
import {
  createExpenseCategory,
  deleteExpenseCategory,
  expenseErrorMessage,
  expenseKindLabel,
  fetchExpenseCategories,
  formatExpenseMoney,
  updateExpenseCategory,
  type ExpenseCategory,
  type ExpenseKind,
} from '@/lib/expensesApi';
import { isForbiddenError } from '@/lib/errorHandler';

const emptyForm = () => ({
  name: '',
  kind: 'PETTY' as ExpenseKind,
  isRecurring: false,
  defaultAmount: '',
  sortOrder: '0',
});

function categoryToForm(c: ExpenseCategory) {
  return {
    name: c.name || '',
    kind: c.kind,
    isRecurring: c.isRecurring,
    defaultAmount: c.defaultAmount != null ? String(c.defaultAmount) : '',
    sortOrder: String(c.sortOrder ?? 0),
  };
}

export default function ExpenseHeadsPage() {
  const { can } = useAuth();
  const canRead = can(EXPENSE_PERMISSION_KEYS.read);
  const canManage = can(EXPENSE_PERMISSION_KEYS.manage);
  const canDelete = can(EXPENSE_PERMISSION_KEYS.delete);
  const showActions = canManage || canDelete;
  const { alert, showAlert, closeAlert } = useAlert();

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [statusSubmittingId, setStatusSubmittingId] = useState<number | null>(null);
  const [deactivateDialog, setDeactivateDialog] = useState<{
    isOpen: boolean;
    id: number | null;
    name: string;
  }>({ isOpen: false, id: null, name: '' });

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!canRead) {
        setCategories([]);
        if (!opts?.silent) setLoading(false);
        return;
      }
      try {
        if (!opts?.silent) setLoading(true);
        const list = await fetchExpenseCategories(true);
        setCategories(list);
      } catch (error: unknown) {
        if (!isForbiddenError(error)) {
          showAlert('error', 'Error', expenseErrorMessage(error));
        } else {
          showAlert('error', 'Permission required', "You don't have permission to view expense heads.");
        }
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [canRead, showAlert]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setFormData(emptyForm());
    setEditing(null);
  };

  const openAdd = () => {
    resetForm();
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEdit = (category: ExpenseCategory) => {
    setEditing(category);
    setFormData(categoryToForm(category));
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    const name = formData.name.trim();
    if (!name) {
      showAlert('warning', 'Validation', 'Name is required.');
      return;
    }
    if (name.length > 128) {
      showAlert('warning', 'Validation', 'Name cannot exceed 128 characters.');
      return;
    }
    const defaultRaw = formData.defaultAmount.trim();
    let defaultAmount: number | null = null;
    if (defaultRaw !== '') {
      const n = Number(defaultRaw);
      if (!Number.isFinite(n) || n < 0) {
        showAlert('warning', 'Validation', 'Default amount must be 0 or greater.');
        return;
      }
      defaultAmount = n;
    }
    const sortOrder = formData.sortOrder.trim() === '' ? 0 : parseInt(formData.sortOrder, 10);
    if (!Number.isInteger(sortOrder)) {
      showAlert('warning', 'Validation', 'Sort order must be a whole number.');
      return;
    }
    try {
      setLoading(true);
      const payload = {
        name,
        kind: formData.kind,
        isRecurring: formData.isRecurring,
        defaultAmount,
        sortOrder,
      };
      if (editing) {
        await updateExpenseCategory(editing.id, payload);
        showAlert('success', 'Head updated', `"${name}" saved.`);
      } else {
        await createExpenseCategory(payload);
        showAlert('success', 'Head added', `"${name}" created.`);
      }
      notifyExpenseChanged();
      setShowForm(false);
      resetForm();
      await load({ silent: true });
    } catch (error: unknown) {
      showAlert('error', 'Error', expenseErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = async (category: ExpenseCategory) => {
    if (!canManage || statusSubmittingId) return;
    try {
      setStatusSubmittingId(category.id);
      await updateExpenseCategory(category.id, { isActive: true });
      showAlert('success', 'Reactivated', `"${category.name}" is active again.`);
      notifyExpenseChanged();
      await load({ silent: true });
    } catch (error: unknown) {
      showAlert('error', 'Error', expenseErrorMessage(error));
    } finally {
      setStatusSubmittingId(null);
    }
  };

  const handleDeactivateConfirm = async () => {
    if (!deactivateDialog.id || !canDelete) return;
    try {
      setLoading(true);
      await deleteExpenseCategory(deactivateDialog.id);
      showAlert(
        'success',
        'Head deactivated',
        `"${deactivateDialog.name}" is hidden from new expenses. Historical rows keep the name.`
      );
      notifyExpenseChanged();
      setDeactivateDialog({ isOpen: false, id: null, name: '' });
      await load({ silent: true });
    } catch (error: unknown) {
      showAlert('error', 'Error', expenseErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const showPageSkeleton = loading && categories.length === 0;

  return (
    <Layout>
      <Alert
        isOpen={alert.isOpen}
        onClose={closeAlert}
        type={alert.type}
        title={alert.title}
        message={alert.message}
      />
      <ConfirmationDialog
        isOpen={deactivateDialog.isOpen}
        onClose={() => setDeactivateDialog({ isOpen: false, id: null, name: '' })}
        onConfirm={handleDeactivateConfirm}
        title="Deactivate expense head"
        message={`Deactivate "${deactivateDialog.name}"? It will no longer appear when adding expenses. Existing entries keep this name.`}
        confirmText="Deactivate"
        cancelText="Cancel"
        type="danger"
      />

      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-dark-gray">Expense heads</h1>
            <p className="mt-1 text-sm text-gray-500">
              Categories for gym spending (rent, utilities, petty cash, and others you add). Deactivated heads stay on
              historical expense rows.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/expenses"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-dark-gray hover:bg-gray-50"
            >
              Expense ledger
            </Link>
            {canManage && !showForm && (
              showPageSkeleton ? (
                <Skeleton className="h-10 w-32" />
              ) : (
                <button
                  type="button"
                  onClick={openAdd}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark active:bg-primary-dark"
                >
                  + Add head
                </button>
              )
            )}
          </div>
        </div>

        {showForm && canManage && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-dark-gray">{editing ? 'Edit head' : 'Add head'}</h2>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Name *</label>
                  <input
                    required
                    maxLength={128}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Kind</label>
                  <select
                    value={formData.kind}
                    onChange={(e) => setFormData({ ...formData, kind: e.target.value as ExpenseKind })}
                    className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-primary"
                  >
                    <option value="FIXED">Fixed</option>
                    <option value="PETTY">Petty</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Default amount (PKR)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.defaultAmount}
                    onChange={(e) => setFormData({ ...formData, defaultAmount: e.target.value })}
                    className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-primary"
                    placeholder="Optional, e.g. rent"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Sort order</label>
                  <input
                    type="number"
                    step={1}
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                    className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="md:col-span-2 flex items-center gap-2">
                  <input
                    id="isRecurring"
                    type="checkbox"
                    checked={formData.isRecurring}
                    onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="isRecurring" className="text-sm text-dark-gray">
                    Recurring (expected each month if not yet booked)
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-primary py-2 font-medium text-white hover:bg-primary-dark"
                >
                  {editing ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="flex-1 rounded-lg bg-gray-200 py-2 font-medium text-dark-gray hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {showPageSkeleton ? (
          <>
            <FilterBarSkeleton fields={1} />
            <TableSkeleton rows={8} columns={showActions ? 7 : 6} />
          </>
        ) : (
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-light-gray">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Kind</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Recurring</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Default amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Sort</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Status</th>
                    {showActions && (
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {categories.length === 0 ? (
                    <tr>
                      <td colSpan={showActions ? 7 : 6} className="px-4 py-10 text-center text-sm text-gray-500">
                        No expense heads yet
                      </td>
                    </tr>
                  ) : (
                    categories.map((c) => {
                      const active = c.isActive !== false;
                      return (
                        <tr key={c.id} className={active ? 'hover:bg-gray-50' : 'bg-gray-50/80 text-gray-500'}>
                          <td className="px-4 py-3 text-sm font-medium text-dark-gray">{c.name}</td>
                          <td className="px-4 py-3">
                            <ExpenseKindBadge kind={c.kind} />
                            <span className="sr-only">{expenseKindLabel(c.kind)}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{c.isRecurring ? 'Yes' : 'No'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {c.defaultAmount != null ? formatExpenseMoney(c.defaultAmount) : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{c.sortOrder}</td>
                          <td className="px-4 py-3">
                            {active ? (
                              <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                                Inactive
                              </span>
                            )}
                          </td>
                          {showActions && (
                            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">
                              {canManage && (
                                <button
                                  type="button"
                                  onClick={() => openEdit(c)}
                                  className="mr-3 text-blue hover:text-blue-900"
                                >
                                  Edit
                                </button>
                              )}
                              {canManage && !active && (
                                <button
                                  type="button"
                                  disabled={statusSubmittingId === c.id}
                                  onClick={() => void handleReactivate(c)}
                                  className="mr-3 text-primary hover:text-primary-dark disabled:opacity-50"
                                >
                                  {statusSubmittingId === c.id ? 'Saving…' : 'Reactivate'}
                                </button>
                              )}
                              {canDelete && active && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeactivateDialog({ isOpen: true, id: c.id, name: c.name })
                                  }
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Deactivate
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

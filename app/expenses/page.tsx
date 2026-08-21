'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@/components/Alert';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import Layout from '@/components/Layout';
import { FilterBarSkeleton, TableSkeleton } from '@/components/Skeleton';
import ExpenseEntryDialog from '@/components/expenses/ExpenseEntryDialog';
import ExpenseKindBadge from '@/components/expenses/ExpenseKindBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import { EXPENSE_CHANGED_EVENT, monthFromSpentAt, notifyExpenseChanged } from '@/lib/expenseEvents';
import { EXPENSE_PERMISSION_KEYS } from '@/lib/expensePermissions';
import {
  createExpenseEntry,
  currentExpenseMonth,
  deleteExpenseEntry,
  expenseErrorMessage,
  expenseMethodLabel,
  fetchExpenseCategories,
  fetchExpenseEntries,
  formatExpenseMoney,
  monthDateRange,
  updateExpenseEntry,
  type ExpenseCategory,
  type ExpenseEntry,
  type ExpenseKind,
  type ExpensePaymentMethod,
} from '@/lib/expensesApi';
import { formatDate } from '@/lib/dateUtils';
import { isForbiddenError } from '@/lib/errorHandler';

const KIND_TABS: { id: '' | ExpenseKind; label: string }[] = [
  { id: '', label: 'All' },
  { id: 'FIXED', label: 'Fixed' },
  { id: 'PETTY', label: 'Petty' },
  { id: 'OTHER', label: 'Other' },
];

export default function ExpensesPage() {
  const { can } = useAuth();
  const canRead = can(EXPENSE_PERMISSION_KEYS.read);
  const canManage = can(EXPENSE_PERMISSION_KEYS.manage);
  const canDelete = can(EXPENSE_PERMISSION_KEYS.delete);
  const showActions = canManage || canDelete;
  const { alert, showAlert, closeAlert } = useAlert();

  const defaultRange = useMemo(() => monthDateRange(currentExpenseMonth()), []);
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [kind, setKind] = useState<'' | ExpenseKind>('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    id: number | null;
    label: string;
    spentAt?: string;
  }>({ isOpen: false, id: null, label: '' });

  const activeCategories = useMemo(() => categories.filter((c) => c.isActive !== false), [categories]);

  const loadCategories = useCallback(async () => {
    if (!canRead) return;
    try {
      const list = await fetchExpenseCategories(false);
      setCategories(list);
    } catch (error: unknown) {
      if (!isForbiddenError(error)) {
        showAlert('error', 'Error', expenseErrorMessage(error));
      }
    }
  }, [canRead, showAlert]);

  const loadEntries = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!canRead) {
        setEntries([]);
        if (!opts?.silent) setLoading(false);
        return;
      }
      try {
        if (!opts?.silent) setLoading(true);
        const result = await fetchExpenseEntries({
          from: from || undefined,
          to: to || undefined,
          categoryId: categoryId ? Number(categoryId) : undefined,
          kind: kind || undefined,
          page,
          limit: 50,
        });
        setEntries(result.entries);
        setPagination(result.pagination);
      } catch (error: unknown) {
        if (isForbiddenError(error)) {
          showAlert('error', 'Permission required', "You don't have permission to view expenses.");
        } else {
          showAlert('error', 'Error', expenseErrorMessage(error));
        }
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [canRead, from, to, categoryId, kind, page, showAlert]
  );

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    const onChanged = () => {
      void loadCategories();
      void loadEntries({ silent: true });
    };
    window.addEventListener(EXPENSE_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(EXPENSE_CHANGED_EVENT, onChanged);
  }, [loadCategories, loadEntries]);

  const pageTotal = useMemo(
    () => entries.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [entries]
  );

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (row: ExpenseEntry) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const handleSave = async (payload: {
    categoryId: number;
    amount: number;
    spentAt: string;
    paymentMethod: ExpensePaymentMethod | null;
    notes: string | null;
  }) => {
    if (!canManage) return;
    try {
      setSubmitting(true);
      if (editing) {
        await updateExpenseEntry(editing.id, payload);
        showAlert('success', 'Expense updated', 'Changes saved.');
      } else {
        await createExpenseEntry(payload);
        showAlert('success', 'Expense added', 'Entry saved.');
      }
      notifyExpenseChanged(monthFromSpentAt(payload.spentAt) || monthFromSpentAt(editing?.spentAt));
      setDialogOpen(false);
      setEditing(null);
      await loadEntries({ silent: true });
    } catch (error: unknown) {
      showAlert('error', 'Error', expenseErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.id || !canDelete) return;
    try {
      setLoading(true);
      await deleteExpenseEntry(deleteDialog.id);
      showAlert('success', 'Expense deleted', `"${deleteDialog.label}" removed.`);
      notifyExpenseChanged(monthFromSpentAt(deleteDialog.spentAt));
      setDeleteDialog({ isOpen: false, id: null, label: '' });
      await loadEntries({ silent: true });
    } catch (error: unknown) {
      showAlert('error', 'Error', expenseErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const showPageSkeleton = loading && entries.length === 0;

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
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null, label: '' })}
        onConfirm={handleDeleteConfirm}
        title="Delete expense"
        message={`Delete "${deleteDialog.label}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
      <ExpenseEntryDialog
        open={dialogOpen}
        entry={editing}
        activeCategories={activeCategories}
        submitting={submitting}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSave}
      />

      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-dark-gray">Expenses</h1>
            <p className="mt-1 text-sm text-gray-500">
              Track gym spending against flexible heads. Membership income stays on Payments; this ledger is expenses
              only.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <Link
                href="/expenses/heads"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-dark-gray hover:bg-gray-50"
              >
                Manage heads
              </Link>
            )}
            {!canManage && canRead && (
              <Link
                href="/expenses/heads"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-dark-gray hover:bg-gray-50"
              >
                Expense heads
              </Link>
            )}
            {can('gym.financialReports.read') && (
              <Link
                href="/reports/pnl"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-dark-gray hover:bg-gray-50"
              >
                Profit &amp; Loss
              </Link>
            )}
            {canManage && (
              <button
                type="button"
                onClick={openAdd}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark active:bg-primary-dark"
              >
                + Add expense
              </button>
            )}
          </div>
        </div>

        {showPageSkeleton ? (
          <>
            <FilterBarSkeleton fields={4} />
            <TableSkeleton rows={8} columns={showActions ? 8 : 7} />
          </>
        ) : (
          <>
            <div className="rounded-lg bg-white p-4 shadow">
              <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">From</label>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      setPage(1);
                    }}
                    className="rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">To</label>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => {
                      setTo(e.target.value);
                      setPage(1);
                    }}
                    className="rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Head</label>
                  <select
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      setPage(1);
                    }}
                    className="min-w-[10rem] rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="">All heads</option>
                    {activeCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-1">
                  {KIND_TABS.map((tab) => (
                    <button
                      key={tab.label}
                      type="button"
                      onClick={() => {
                        setKind(tab.id);
                        setPage(1);
                      }}
                      className={`rounded-lg px-3 py-2 text-sm font-medium ${
                        kind === tab.id
                          ? 'bg-primary text-white'
                          : 'border border-gray-200 text-dark-gray hover:bg-gray-50'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg bg-white shadow">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-light-gray">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Head</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Kind</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Method</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Notes</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Created by</th>
                      {showActions && (
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-dark-gray">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {entries.length === 0 ? (
                      <tr>
                        <td
                          colSpan={showActions ? 8 : 7}
                          className="px-4 py-10 text-center text-sm text-gray-500"
                        >
                          No expenses in this range.
                        </td>
                      </tr>
                    ) : (
                      entries.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-dark-gray">
                            {formatDate(row.spentAt)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-dark-gray">
                            {row.category?.name || '—'}
                            {row.category && row.category.isActive === false && (
                              <span className="ml-2 text-xs font-normal text-gray-400">(inactive)</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <ExpenseKindBadge kind={row.category?.kind} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-dark-gray">
                            {formatExpenseMoney(row.amount)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {expenseMethodLabel(row.paymentMethod)}
                          </td>
                          <td className="max-w-xs px-4 py-3 text-sm text-gray-500">
                            <span className="line-clamp-2">{row.notes || '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{row.createdBy?.name || '—'}</td>
                          {showActions && (
                            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">
                              {canManage && (
                                <button
                                  type="button"
                                  onClick={() => openEdit(row)}
                                  className="mr-3 text-blue hover:text-blue-900"
                                >
                                  Edit
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteDialog({
                                      isOpen: true,
                                      id: row.id,
                                      label: `${row.category?.name || 'Expense'} · ${formatExpenseMoney(row.amount)}`,
                                      spentAt: row.spentAt,
                                    })
                                  }
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Delete
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm text-gray-600">
                <span>
                  {pagination.totalPages <= 1 ? 'Total' : 'This page'}:{' '}
                  <strong className="text-dark-gray">{formatExpenseMoney(pageTotal)}</strong>
                  {pagination.total > 0 && (
                    <span className="ml-2 text-gray-400">
                      ({pagination.total} {pagination.total === 1 ? 'entry' : 'entries'})
                    </span>
                  )}
                </span>
                {pagination.totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <span>
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="rounded border px-2 py-1 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={page >= pagination.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded border px-2 py-1 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

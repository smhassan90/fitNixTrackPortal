'use client';

import { useCallback, useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import Alert from '@/components/Alert';
import Loading from '@/components/Loading';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import { isGymAdmin } from '@/lib/gymRoles';
import {
  type PackageFeature,
  createPackageFeature,
  deletePackageFeature,
  fetchAllPackageFeatures,
  isValidFeatureCode,
  packageFeatureErrorMessage,
  sanitizeFeatureCode,
  updatePackageFeature,
} from '@/lib/packageFeaturesApi';

const emptyForm = () => ({
  name: '',
  code: '',
  description: '',
  isActive: true,
  sortOrder: '0',
});

export default function PackageFeaturesPage() {
  const { user } = useAuth();
  const { alert, showAlert, closeAlert } = useAlert();
  const canManage = isGymAdmin(user?.role);

  const [rows, setRows] = useState<PackageFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PackageFeature | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    feature: PackageFeature | null;
  }>({ open: false, feature: null });

  const load = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const list = await fetchAllPackageFeatures();
      setRows(list);
    } catch (err: unknown) {
      showAlert('error', 'Could not load features', packageFeatureErrorMessage(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [canManage, showAlert]);

  useEffect(() => {
    void load();
  }, [load]);

  const startAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const startEdit = (f: PackageFeature) => {
    setEditing(f);
    setForm({
      name: f.name,
      code: f.code ?? '',
      description: f.description ?? '',
      isActive: f.isActive,
      sortOrder: String(f.sortOrder ?? 0),
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm());
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    const name = form.name.trim();
    if (!name) {
      showAlert('error', 'Required', 'Feature name is required.');
      return;
    }

    const code = sanitizeFeatureCode(form.code);
    if (form.code.trim() && !isValidFeatureCode(code)) {
      showAlert('error', 'Invalid code', 'Code may only contain A–Z, 0–9, and underscore.');
      return;
    }

    const sortOrder = Number(form.sortOrder);
    if (!Number.isFinite(sortOrder)) {
      showAlert('error', 'Invalid sort order', 'Sort order must be a number.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updatePackageFeature(editing.id, {
          name,
          code: code || undefined,
          description: form.description.trim() || undefined,
          isActive: form.isActive,
          sortOrder,
        });
        showAlert('success', 'Feature updated', `"${name}" was saved.`);
      } else {
        await createPackageFeature({
          name,
          ...(code ? { code } : {}),
          ...(form.description.trim() ? { description: form.description.trim() } : {}),
          isActive: form.isActive,
          sortOrder,
        });
        showAlert('success', 'Feature added', `"${name}" is available for packages.`);
      }
      cancelForm();
      await load();
    } catch (err: unknown) {
      showAlert('error', editing ? 'Update failed' : 'Create failed', packageFeatureErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (f: PackageFeature) => {
    if (!canManage || saving) return;
    setSaving(true);
    try {
      await updatePackageFeature(f.id, { isActive: !f.isActive });
      showAlert(
        'success',
        f.isActive ? 'Feature deactivated' : 'Feature activated',
        f.isActive
          ? `"${f.name}" will no longer appear on new package forms.`
          : `"${f.name}" is available on package forms again.`
      );
      await load();
    } catch (err: unknown) {
      showAlert('error', 'Update failed', packageFeatureErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const onConfirmDelete = async () => {
    const f = deleteDialog.feature;
    if (!f) return;
    // Capture before ConfirmationDialog's onClose clears state.
    const featureId = f.id;
    const featureName = f.name;
    setSaving(true);
    try {
      await deletePackageFeature(featureId);
      showAlert('success', 'Feature deleted', `"${featureName}" was removed from the catalog.`);
      setDeleteDialog({ open: false, feature: null });
      await load();
    } catch (err: unknown) {
      showAlert('error', 'Delete failed', packageFeatureErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <Layout>
        <Alert
          isOpen={alert.isOpen}
          onClose={closeAlert}
          type={alert.type}
          title={alert.title}
          message={alert.message}
        />
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-gray-900">Package features</h1>
          <p className="mt-2 text-gray-600">
            Only a gym <strong>administrator</strong> can add or edit the feature catalog used on
            packages. Ask a gym admin if you need a new feature option.
          </p>
        </div>
      </Layout>
    );
  }

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
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, feature: null })}
        onConfirm={() => void onConfirmDelete()}
        title="Delete feature"
        message={
          deleteDialog.feature
            ? `Delete "${deleteDialog.feature.name}"? This cannot be undone if the server permanently removes it. Features assigned to packages cannot be deleted.`
            : ''
        }
        type="danger"
        confirmText="Delete"
      />

      <div className="max-w-5xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Package features</h1>
            <p className="mt-1 text-sm text-gray-600 max-w-2xl">
              Shared catalog of options shown as checkboxes when creating or editing packages.
              Only <strong>active</strong> features appear on the package form.
            </p>
          </div>
          <button
            type="button"
            onClick={startAdd}
            className="mt-2 sm:mt-0 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
            disabled={saving}
          >
            Add feature
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={(e) => void onSubmit(e)}
            className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-gray-900">
              {editing ? 'Edit feature' : 'Add feature'}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-1">
                <span className="text-sm font-medium text-gray-700">Name *</span>
                <input
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Personal training"
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="text-sm font-medium text-gray-700">Code (optional)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono uppercase"
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: sanitizeFeatureCode(e.target.value) }))
                  }
                  placeholder="PERSONAL_TRAINING"
                />
                <p className="mt-1 text-xs text-gray-500">A–Z, 0–9, underscore only.</p>
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-gray-700">Description (optional)</span>
                <textarea
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="text-sm font-medium text-gray-700">Sort order</span>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                />
              </label>
              <label className="flex items-center gap-2 sm:col-span-1 self-end pb-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create feature'}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading && (
          <div className="mt-8">
            <Loading message="Loading features…" size="md" />
          </div>
        )}

        {!loading && rows.length === 0 && !showForm && (
          <div className="mt-8 rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <p className="text-dark-gray font-medium">No package features configured</p>
            <p className="mt-1 text-sm text-gray-500">
              Add features so they appear as options when creating packages.
            </p>
            <button
              type="button"
              onClick={startAdd}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
            >
              Add feature
            </button>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="mt-8 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                    Active
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                    Sort order
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((f) => (
                  <tr key={f.id} className={!f.isActive ? 'bg-gray-50' : undefined}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="font-medium">{f.name}</div>
                      {f.description && (
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {f.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">
                      {f.code || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {f.isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-700">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{f.sortOrder}</td>
                    <td className="px-4 py-3 text-right text-sm">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => startEdit(f)}
                          disabled={saving}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-gray-700 hover:underline disabled:opacity-40"
                          onClick={() => void toggleActive(f)}
                          disabled={saving}
                        >
                          {f.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="text-red-600 hover:underline disabled:opacity-40"
                          onClick={() => setDeleteDialog({ open: true, feature: f })}
                          disabled={saving}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}

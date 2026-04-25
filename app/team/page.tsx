'use client';

import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import Alert from '@/components/Alert';
import Loading from '@/components/Loading';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import GeneratedPasswordModal from '@/components/platform/GeneratedPasswordModal';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import {
  GYM_TEAM_ROLE_OPTIONS,
  type GymTeamUser,
  createGymTeamUser,
  fetchGymTeamUsers,
  updateGymTeamUser,
  removeGymTeamUser,
  toUserMessage,
} from '@/lib/gymTeamUsersApi';
import { getErrorMessage } from '@/lib/errorHandler';

const emptyForm = () => ({
  name: '',
  email: '',
  phone: '',
  role: 'GYM_STAFF' as string,
  password: '',
});

export default function TeamPage() {
  const { user } = useAuth();
  const { alert, showAlert, closeAlert } = useAlert();
  const isGymAdmin = user?.role === 'GYM_ADMIN';

  const [rows, setRows] = useState<GymTeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiMissing, setApiMissing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editing, setEditing] = useState<GymTeamUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [genPw, setGenPw] = useState<string | null>(null);
  const [removeDialog, setRemoveDialog] = useState<{ open: boolean; u: GymTeamUser | null }>({
    open: false,
    u: null,
  });

  const canManage = isGymAdmin;

  const load = useCallback(async () => {
    if (!isGymAdmin) {
      setLoading(false);
      return;
    }
    try {
      setApiMissing(false);
      setLoading(true);
      const list = await fetchGymTeamUsers();
      setRows(list);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setApiMissing(true);
        setRows([]);
        return;
      }
      showAlert('error', 'Could not load team', toUserMessage(e) || getErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [isGymAdmin, showAlert]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (r: GymTeamUser) => {
    setEditing(r);
    setForm({
      name: r.name,
      email: r.email,
      phone: r.phone ?? '',
      role: r.role,
      password: '',
    });
    setShowAddForm(false);
  };

  const startAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowAddForm(true);
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditing(null);
    setForm(emptyForm());
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    if (!form.name.trim() || !form.email.trim()) {
      showAlert('error', 'Required', 'Name and email are required.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const isSelf = String(editing.id) === String(user?.id);
        if (isSelf && form.role !== 'GYM_ADMIN') {
          showAlert('error', 'Not allowed', 'You cannot remove your own administrator role from here.');
          setSaving(false);
          return;
        }
        await updateGymTeamUser(editing.id, {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          role: form.role,
          ...(form.password.trim() ? { password: form.password } : {}),
        });
        showAlert('success', 'Saved', 'User updated.');
        cancelForm();
        await load();
      } else {
        const result = await createGymTeamUser({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          role: form.role,
          password: form.password.trim() || undefined,
        });
        if (result.temporaryPassword) {
          setGenPw(result.temporaryPassword);
        } else {
          showAlert('success', 'User created', 'The team member can now sign in (if a password or invite was configured by the server).');
        }
        cancelForm();
        await load();
      }
    } catch (err) {
      showAlert('error', 'Request failed', getErrorMessage(err as object));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (r: GymTeamUser) => {
    if (!canManage) return;
    if (String(r.id) === String(user?.id) && r.isActive) {
      showAlert('error', 'Not allowed', 'You cannot deactivate your own account while signed in.');
      return;
    }
    try {
      setSaving(true);
      await updateGymTeamUser(r.id, { isActive: !r.isActive });
      showAlert('success', 'Updated', !r.isActive ? 'User can sign in again.' : 'Access paused for this user.');
      await load();
    } catch (err) {
      showAlert('error', 'Error', getErrorMessage(err as object));
    } finally {
      setSaving(false);
    }
  };

  const onConfirmRemove = async () => {
    const r = removeDialog.u;
    if (!r) return;
    if (String(r.id) === String(user?.id)) {
      showAlert('error', 'Not allowed', 'You cannot remove your own account while signed in.');
      setRemoveDialog({ open: false, u: null });
      return;
    }
    try {
      setSaving(true);
      await removeGymTeamUser(r.id);
      showAlert('success', 'Removed', 'This user can no longer sign in.');
      setRemoveDialog({ open: false, u: null });
      await load();
    } catch (err) {
      showAlert('error', 'Error', getErrorMessage(err as object));
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = useCallback((code: string) => {
    return GYM_TEAM_ROLE_OPTIONS.find((o) => o.value === code)?.label ?? code;
  }, []);

  if (!isGymAdmin) {
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
          <h1 className="text-2xl font-bold text-gray-900">Team & logins</h1>
          <p className="mt-2 text-gray-600">
            Only a gym <strong>administrator</strong> can add or manage staff who sign in to this portal.
            Ask a gym admin to sign in and use this screen, or have the platform team promote your
            account.
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
      <GeneratedPasswordModal
        open={!!genPw}
        password={genPw || ''}
        onClose={() => setGenPw(null)}
        title="Temporary password for new team member"
        description="Copy this password now. It will not be shown again. Send it to the new user through a private channel. Do not paste into shared chat or email unless encrypted."
      />
      <ConfirmationDialog
        isOpen={removeDialog.open}
        onClose={() => setRemoveDialog({ open: false, u: null })}
        onConfirm={onConfirmRemove}
        title="Remove team member"
        message={
          removeDialog.u
            ? `Remove sign-in access for ${removeDialog.u.name}? This cannot be undone.`
            : ''
        }
        type="danger"
        confirmText="Remove access"
      />

      <div className="max-w-5xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team & logins</h1>
            <p className="mt-1 text-sm text-gray-600 max-w-2xl">
              People who can sign in to the gym admin portal for <strong>{user?.gymName || 'this gym'}</strong>.
              Members, packages, and trainers are managed in their own pages — here you only manage
              <strong> accounts </strong> (e.g. front desk, co-owner, manager).
            </p>
          </div>
          <button
            type="button"
            onClick={startAdd}
            className="mt-2 sm:mt-0 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
            disabled={saving || apiMissing}
          >
            Add team member
          </button>
        </div>

        {apiMissing && (
          <div className="mt-6 rounded-xl border-2 border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Team user API is not available yet</p>
            <p className="mt-1">
              The server must expose gym-scoped user management under <code className="rounded bg-white/80 px-1">/api/gym/users</code>
              (see the backend implementation prompt shared with your team). Until then, you can use the
              first owner account from platform gym creation, or have platform add accounts.
            </p>
          </div>
        )}

        {(showAddForm || editing) && !apiMissing && (
          <form
            onSubmit={onSubmit}
            className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-gray-900">
              {editing ? 'Edit team member' : 'New team member'}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-1">
                <span className="text-sm font-medium text-gray-700">Full name</span>
                <input
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="text-sm font-medium text-gray-700">Work email (login)</span>
                <input
                  type="email"
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  autoComplete="off"
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="text-sm font-medium text-gray-700">Phone (optional)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="text-sm font-medium text-gray-700">Role</span>
                <select
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                >
                  {GYM_TEAM_ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label} ({o.value})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Administrators can manage this screen, billing, and other admins. Managers and staff have
                  more limited access (once enforced on the server).
                </p>
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-gray-700">
                  {editing ? 'New password (optional)' : 'Password (optional)'}
                </span>
                <input
                  type="password"
                  className="mt-1 w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={editing ? 'Leave empty to keep current' : 'Leave empty to let server auto-generate'}
                  autoComplete="new-password"
                />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create user'}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading && (
          <div className="mt-8">
            <Loading message="Loading team…" size="md" />
          </div>
        )}

        {!loading && !apiMissing && (
          <div className="mt-8 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                      No additional team logins yet. The owner account from gym setup can sign in; add staff
                      here.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const isYou = String(r.id) === String(user?.id);
                    return (
                      <tr key={r.id} className={!r.isActive ? 'bg-gray-50' : undefined}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {r.name}
                          {isYou && (
                            <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">You</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{r.email}</td>
                        <td className="px-4 py-3 text-sm text-gray-800">{roleLabel(r.role)}</td>
                        <td className="px-4 py-3 text-sm">
                          {r.isActive ? (
                            <span className="text-green-700">Active</span>
                          ) : (
                            <span className="text-amber-700">Inactive</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              className="text-primary hover:underline"
                              onClick={() => startEdit(r)}
                              disabled={saving}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-gray-700 hover:underline disabled:opacity-40"
                              onClick={() => toggleActive(r)}
                              disabled={saving || (isYou && r.isActive)}
                            >
                              {r.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              className="text-red-600 hover:underline disabled:opacity-40"
                              onClick={() => setRemoveDialog({ open: true, u: r })}
                              disabled={saving || isYou}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}

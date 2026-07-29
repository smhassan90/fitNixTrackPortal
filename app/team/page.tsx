'use client';

import { Fragment, useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '@/components/Layout';
import Alert from '@/components/Alert';
import Loading from '@/components/Loading';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import AnimatedCheckbox from '@/components/AnimatedCheckbox';
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
import {
  fetchGymPermissionsCatalog,
  togglePermissionKeyWithCascade,
  type GymAlwaysAvailablePermission,
  type GymPermissionDefinition,
} from '@/lib/gymPermissionsApi';
import { getErrorMessage } from '@/lib/errorHandler';
import { isGymAdmin } from '@/lib/gymRoles';
import { POS_TEAM_PERMISSION_DEFS } from '@/lib/pos/permissions';
import { EMPLOYEE_TEAM_PERMISSION_DEFS } from '@/lib/employeePermissions';

const emptyForm = () => ({
  name: '',
  email: '',
  phone: '',
  role: 'GYM_STAFF' as string,
  password: '',
  permissionKeys: [] as string[],
});

export default function TeamPage() {
  const { user, can } = useAuth();
  const { alert, showAlert, closeAlert } = useAlert();
  const canManageTeam = can('gym.team.manage');
  const actorIsAdmin = isGymAdmin(user?.role);

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
  const [catalog, setCatalog] = useState<GymPermissionDefinition[]>([]);
  const [alwaysAvailable, setAlwaysAvailable] = useState<GymAlwaysAvailablePermission[]>([]);

  const showTeamError = useCallback(
    (err: unknown, fallbackTitle = 'Request failed') => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        showAlert(
          'error',
          "You don't have permission",
          "You don't have permission to perform this action."
        );
        return;
      }
      if (status === 409) {
        showAlert(
          'error',
          'Email already exists',
          'A user with this email already exists in this gym. Use a different email.'
        );
        return;
      }
      showAlert('error', fallbackTitle, getErrorMessage(err as object));
    },
    [showAlert]
  );

  const loadCatalog = useCallback(async () => {
    try {
      const data = await fetchGymPermissionsCatalog();
      const merged = [...data.permissions];
      const keys = new Set(merged.map((p) => p.key));
      for (const p of [...POS_TEAM_PERMISSION_DEFS, ...EMPLOYEE_TEAM_PERMISSION_DEFS]) {
        if (!keys.has(p.key)) merged.push({ ...p });
      }
      setCatalog(merged);
      setAlwaysAvailable(data.alwaysAvailable);
    } catch {
      setCatalog([...POS_TEAM_PERMISSION_DEFS, ...EMPLOYEE_TEAM_PERMISSION_DEFS]);
      setAlwaysAvailable([
        {
          key: 'gym.attendance.read',
          label: 'View attendance',
          description: 'Attendance viewing is available to every active gym team member.',
        },
      ]);
    }
  }, []);

  const load = useCallback(async () => {
    if (!canManageTeam) {
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
      if (status === 403) {
        showAlert('error', "You don't have permission", "You don't have permission to manage team users.");
        setRows([]);
        return;
      }
      showAlert('error', 'Could not load team', toUserMessage(e) || getErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [canManageTeam, showAlert]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Permission matrix: one row per feature (derived from the key's resource
   * segment), with View / Manage / Delete columns. Non-standard actions render
   * as their own full-width rows so nothing from the catalog is dropped.
   */
  const permissionMatrix = useMemo(() => {
    type MatrixAction = 'read' | 'manage' | 'delete';
    type MatrixRow = {
      resource: string;
      label: string;
      cells: Partial<Record<MatrixAction, GymPermissionDefinition>>;
      extras: GymPermissionDefinition[];
    };
    type MatrixGroup = { group: string; rows: MatrixRow[] };

    const humanize = (resource: string) => {
      const spaced = resource.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
      return spaced.charAt(0).toUpperCase() + spaced.slice(1);
    };

    const groups: MatrixGroup[] = [];
    const groupIndex = new Map<string, MatrixGroup>();
    const rowIndex = new Map<string, MatrixRow>();

    for (const p of catalog) {
      const groupName = p.group || 'General';
      let g = groupIndex.get(groupName);
      if (!g) {
        g = { group: groupName, rows: [] };
        groupIndex.set(groupName, g);
        groups.push(g);
      }

      const parts = p.key.split('.');
      const action = parts[parts.length - 1];
      const resource = parts.length >= 3 ? parts[1] : p.key;
      const rowKey = `${groupName}::${resource}`;

      let row = rowIndex.get(rowKey);
      if (!row) {
        row = { resource, label: humanize(resource), cells: {}, extras: [] };
        rowIndex.set(rowKey, row);
        g.rows.push(row);
      }

      if (action === 'read' || action === 'manage' || action === 'delete') {
        row.cells[action] = p;
      } else {
        row.extras.push(p);
      }
    }

    return groups;
  }, [catalog]);

  const catalogKeys = useMemo(() => catalog.map((p) => p.key), [catalog]);
  const selectedCount = form.permissionKeys.length;

  const formIsAdminRole = isGymAdmin(form.role);
  const editingIsLegacy = Boolean(editing?.usesLegacyPermissions);

  const canEditTarget = useCallback(
    (target: GymTeamUser) => {
      if (!canManageTeam) return false;
      if (isGymAdmin(target.role) && !actorIsAdmin) return false;
      return true;
    },
    [canManageTeam, actorIsAdmin]
  );

  /** Non-admins cannot assign permissions they themselves lack. */
  const canAssignKey = useCallback(
    (key: string) => {
      if (actorIsAdmin) return true;
      return can(key);
    },
    [actorIsAdmin, can]
  );

  const startEdit = (r: GymTeamUser) => {
    if (!canEditTarget(r)) {
      showAlert('error', "You don't have permission", 'Only an administrator can edit administrator accounts.');
      return;
    }
    setEditing(r);
    setForm({
      name: r.name,
      email: r.email,
      phone: r.phone ?? '',
      role: r.role,
      password: '',
      permissionKeys: [...(r.permissionKeys || [])],
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

  const onTogglePermission = (key: string) => {
    if (!canAssignKey(key)) return;
    setForm((f) => ({
      ...f,
      permissionKeys: togglePermissionKeyWithCascade(f.permissionKeys, key, catalogKeys),
    }));
  };

  const onRoleChange = (role: string) => {
    setForm((f) => ({
      ...f,
      role,
      // Admins get all permissions server-side; clear checkboxes in the form.
      permissionKeys: isGymAdmin(role) ? [] : f.permissionKeys,
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageTeam) return;
    if (!form.name.trim() || !form.email.trim()) {
      showAlert('error', 'Required', 'Name and email are required.');
      return;
    }
    if (isGymAdmin(form.role) && !actorIsAdmin) {
      showAlert('error', "You don't have permission", 'Only an administrator can create or promote administrators.');
      return;
    }
    setSaving(true);
    try {
      const permissionKeys = isGymAdmin(form.role) ? [] : form.permissionKeys;

      if (editing) {
        if (!canEditTarget(editing)) {
          showAlert('error', "You don't have permission", 'Only an administrator can edit administrator accounts.');
          setSaving(false);
          return;
        }
        const isSelf = String(editing.id) === String(user?.id);
        if (isSelf && form.role !== 'GYM_ADMIN' && actorIsAdmin) {
          showAlert('error', 'Not allowed', 'You cannot remove your own administrator role from here.');
          setSaving(false);
          return;
        }
        await updateGymTeamUser(editing.id, {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          role: form.role,
          permissionKeys,
          ...(form.password.trim() ? { password: form.password } : {}),
        });
        showAlert('success', 'Saved', 'User updated.');
        cancelForm();
        await load();
      } else {
        const result = await createGymTeamUser({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          role: form.role,
          password: form.password.trim() || undefined,
          permissionKeys,
        });
        if (result.temporaryPassword) {
          setGenPw(result.temporaryPassword);
        } else {
          showAlert(
            'success',
            'User created',
            'The team member can now sign in (if a password or invite was configured by the server).'
          );
        }
        cancelForm();
        await load();
      }
    } catch (err) {
      showTeamError(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (r: GymTeamUser) => {
    if (!canEditTarget(r)) {
      showAlert('error', "You don't have permission", 'Only an administrator can change administrator accounts.');
      return;
    }
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
      showTeamError(err, 'Error');
    } finally {
      setSaving(false);
    }
  };

  const onConfirmRemove = async () => {
    const r = removeDialog.u;
    if (!r) return;
    if (!canEditTarget(r)) {
      showAlert('error', "You don't have permission", 'Only an administrator can remove administrator accounts.');
      setRemoveDialog({ open: false, u: null });
      return;
    }
    if (String(r.id) === String(user?.id)) {
      showAlert('error', 'Not allowed', 'You cannot remove your own account while signed in.');
      setRemoveDialog({ open: false, u: null });
      return;
    }
    try {
      setSaving(true);
      await removeGymTeamUser(r.id);
      showAlert('success', 'Access removed', 'This account is now inactive and cannot sign in.');
      setRemoveDialog({ open: false, u: null });
      await load();
    } catch (err) {
      showTeamError(err, 'Error');
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = useCallback((code: string) => {
    return GYM_TEAM_ROLE_OPTIONS.find((o) => o.value === code)?.label ?? code;
  }, []);

  const roleOptions = useMemo(() => {
    if (actorIsAdmin) return GYM_TEAM_ROLE_OPTIONS;
    return GYM_TEAM_ROLE_OPTIONS.filter((o) => o.value !== 'GYM_ADMIN');
  }, [actorIsAdmin]);

  if (!canManageTeam) {
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
            You need the <strong>Manage team</strong> permission to add or manage staff who sign in to
            this portal. Ask a gym admin to grant access, or have the platform team update your account.
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
        title="Deactivate team member"
        message={
          removeDialog.u
            ? `Deactivate sign-in access for ${removeDialog.u.name}? You can re-activate later from the list.`
            : ''
        }
        type="danger"
        confirmText="Deactivate"
      />

      <div className="max-w-5xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team & logins</h1>
            <p className="mt-1 text-sm text-gray-600 max-w-2xl">
              People who can sign in to the gym admin portal for <strong>{user?.gymName || 'this gym'}</strong>.
              Members, packages, and trainers are managed in their own pages — here you only manage
              <strong> accounts </strong> and their feature permissions.
            </p>
          </div>
          <button
            type="button"
            onClick={startAdd}
            className="mt-2 sm:mt-0 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark active:bg-primary-dark"
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

            {editingIsLegacy && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                This user still has legacy role-based access. Saving permissions will switch them to
                checkbox-based access.
              </div>
            )}

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
                  onChange={(e) => onRoleChange(e.target.value)}
                >
                  {roleOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label} ({o.value})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Role is still required. Feature access is controlled by the permissions below
                  (administrators always have full access).
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

            <div className="mt-6 border-t border-gray-100 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Permissions</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Select what this teammate can access in the portal. Attendance viewing is always included.
                  </p>
                </div>
                {!formIsAdminRole && catalog.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {selectedCount} selected
                  </span>
                )}
              </div>

              {formIsAdminRole ? (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  Administrators have all permissions. Checkboxes are hidden for admin accounts.
                </div>
              ) : catalog.length === 0 ? (
                <p className="mt-3 text-xs text-gray-500">
                  Permission catalog could not be loaded. You can still save the user; try refreshing
                  if checkboxes do not appear.
                </p>
              ) : (
                <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="sticky top-0 z-10 bg-gray-50">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Feature
                          </th>
                          <th className="w-20 px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">
                            View
                          </th>
                          <th className="w-20 px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Manage
                          </th>
                          <th className="w-20 px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Delete
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {(alwaysAvailable.length > 0 ? alwaysAvailable : [
                          {
                            key: 'gym.attendance.read',
                            label: 'View attendance',
                            description:
                              'Attendance viewing is available to every active gym team member.',
                          },
                        ]).map((item) => (
                          <tr key={item.key} className="bg-emerald-50/50">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-800">{item.label}</span>
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                  Always on
                                </span>
                              </div>
                              {item.description && (
                                <p className="mt-0.5 text-[11px] text-gray-500">{item.description}</p>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <AnimatedCheckbox
                                checked
                                disabled
                                tone="success"
                                ariaLabel={item.label}
                                title="Included for every team member"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-center text-gray-300">—</td>
                            <td className="px-3 py-2.5 text-center text-gray-300">—</td>
                          </tr>
                        ))}

                        {permissionMatrix.map((g) => (
                          <Fragment key={g.group}>
                            <tr className="bg-gray-50">
                              <td
                                colSpan={4}
                                className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500"
                              >
                                {g.group}
                              </td>
                            </tr>
                            {g.rows.map((row) => {
                              const renderCell = (p?: GymPermissionDefinition) => {
                                if (!p) {
                                  return <td className="px-3 py-2.5 text-center text-gray-300">—</td>;
                                }
                                const assignable = canAssignKey(p.key);
                                return (
                                  <td className="px-3 py-2.5 text-center">
                                    <AnimatedCheckbox
                                      checked={form.permissionKeys.includes(p.key)}
                                      onChange={() => onTogglePermission(p.key)}
                                      disabled={saving || !assignable}
                                      ariaLabel={p.label || p.key}
                                      title={
                                        !assignable
                                          ? "You can't grant a permission you don't have yourself"
                                          : p.description || p.label || p.key
                                      }
                                    />
                                  </td>
                                );
                              };
                              return (
                                <Fragment key={`${g.group}::${row.resource}`}>
                                  <tr className="transition-colors hover:bg-gray-50/70">
                                    <td className="px-4 py-2.5 font-medium text-gray-800">
                                      {row.label}
                                    </td>
                                    {renderCell(row.cells.read)}
                                    {renderCell(row.cells.manage)}
                                    {renderCell(row.cells.delete)}
                                  </tr>
                                  {row.extras.map((p) => {
                                    const assignable = canAssignKey(p.key);
                                    return (
                                      <tr key={p.key} className="transition-colors hover:bg-gray-50/70">
                                        <td className="px-4 py-2.5 text-gray-700" colSpan={3}>
                                          <span className="font-medium text-gray-800">
                                            {p.label || p.key}
                                          </span>
                                          {p.description && (
                                            <p className="mt-0.5 text-[11px] text-gray-500">
                                              {p.description}
                                            </p>
                                          )}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                          <AnimatedCheckbox
                                            checked={form.permissionKeys.includes(p.key)}
                                            onChange={() => onTogglePermission(p.key)}
                                            disabled={saving || !assignable}
                                            ariaLabel={p.label || p.key}
                                            title={
                                              !assignable
                                                ? "You can't grant a permission you don't have yourself"
                                                : p.description || p.label || p.key
                                            }
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </Fragment>
                              );
                            })}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-[11px] text-gray-500">
                    Manage includes View. Delete includes Manage and View — checking a higher level
                    selects the lower ones automatically. Hover a checkbox for details.
                  </div>
                </div>
              )}
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
                    const editable = canEditTarget(r);
                    return (
                      <tr key={r.id} className={!r.isActive ? 'bg-gray-50' : undefined}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {r.name}
                          {isYou && (
                            <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">You</span>
                          )}
                          {r.usesLegacyPermissions && (
                            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                              Legacy
                            </span>
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
                              className="text-primary hover:underline disabled:opacity-40"
                              onClick={() => startEdit(r)}
                              disabled={saving || !editable}
                              title={!editable ? 'Only an administrator can edit administrator accounts' : undefined}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-gray-700 hover:underline disabled:opacity-40"
                              onClick={() => toggleActive(r)}
                              disabled={saving || !editable || (isYou && r.isActive)}
                            >
                              {r.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              className="text-red-600 hover:underline disabled:opacity-40"
                              onClick={() => setRemoveDialog({ open: true, u: r })}
                              disabled={saving || isYou || !editable}
                            >
                              Soft remove
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

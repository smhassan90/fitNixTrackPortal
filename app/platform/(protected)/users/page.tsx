'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AxiosError } from 'axios';
import Link from 'next/link';
import {
  deletePlatformUser,
  listPlatformPermissionsCatalog,
  listPlatformUsers,
} from '@/lib/platform/platformApi';
import type { PlatformOperatorUser, PlatformPermissionDefinition } from '@/lib/platform/types';
import { mapPlatformErrorToUserMessage, PlatformApiError } from '@/lib/platform/errors';
import { humanizePlatformRole } from '@/lib/platform/presentation';
import { usePlatformAuth, useIsPlatformSuperAdmin } from '@/contexts/PlatformAuthContext';
import Loading from '@/components/Loading';
import Alert from '@/components/Alert';
import { useAlert } from '@/hooks/useAlert';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import PlatformOperatorUserModal from '@/components/platform/PlatformOperatorUserModal';

function isUsersApiMissing(err: unknown): boolean {
  if (err instanceof PlatformApiError) {
    return err.status === 404 || err.code === 'NOT_FOUND';
  }
  const ax = err as AxiosError<{ error?: { message?: string; code?: string } }>;
  if (ax.response?.status === 404) return true;
  const msg = String(ax.response?.data?.error?.message || ax.message || '');
  return /route\s*not\s*found|not\s*found/i.test(msg);
}

export default function PlatformUsersPage() {
  const { user: me } = usePlatformAuth();
  const isSuper = useIsPlatformSuperAdmin();
  const { alert, showAlert, closeAlert } = useAlert();

  const [rows, setRows] = useState<PlatformOperatorUser[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<PlatformPermissionDefinition[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editId, setEditId] = useState<string | number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlatformOperatorUser | null>(null);
  /** Backend has not shipped `/api/platform/users` yet (404 / route not found). */
  const [usersApiMissing, setUsersApiMissing] = useState(false);

  const loadCatalog = useCallback(async () => {
    try {
      const data = await listPlatformPermissionsCatalog();
      setCatalog(data.permissions || []);
    } catch {
      setCatalog([]);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = {
        page: pagination.page,
        limit: Math.min(pagination.limit, 100),
      };
      if (searchApplied.trim()) params.search = searchApplied.trim();
      if (roleFilter) params.role = roleFilter;
      const data = await listPlatformUsers(params);
      setUsersApiMissing(false);
      setRows(data.users || []);
      const pg = data.pagination;
      if (pg) {
        setPagination((p) => ({
          ...p,
          total: pg.total,
          totalPages: pg.totalPages,
          page: pg.page ?? p.page,
        }));
      }
    } catch (e) {
      if (isUsersApiMissing(e)) {
        setUsersApiMissing(true);
        setRows([]);
        setPagination((p) => ({ ...p, total: 0, totalPages: 1, page: 1 }));
      } else {
        showAlert('error', 'Could not load team', mapPlatformErrorToUserMessage(e));
      }
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchApplied, roleFilter, showAlert]);

  useEffect(() => {
    if (!isSuper) return;
    loadCatalog();
  }, [isSuper, loadCatalog]);

  useEffect(() => {
    if (!isSuper) return;
    loadUsers();
  }, [isSuper, loadUsers]);

  const openCreate = () => {
    setModalMode('create');
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = (u: PlatformOperatorUser) => {
    setModalMode('edit');
    setEditId(u.id);
    setModalOpen(true);
  };

  const runDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePlatformUser(deleteTarget.id);
      setDeleteTarget(null);
      showAlert('success', 'Removed', 'User was deleted.');
      loadUsers();
    } catch (e) {
      showAlert('error', 'Delete failed', mapPlatformErrorToUserMessage(e));
    }
  };

  if (!isSuper) {
    return (
      <div className="rounded-xl border border-warning bg-warning-light/20 p-6 text-sm">
        <h1 className="text-lg font-semibold text-dark-gray">Platform team</h1>
        <p className="mt-2 text-dark-gray-light">
          Only a <strong>super admin</strong> can invite, edit, or remove platform teammates and change their access.
        </p>
        <Link href="/platform" className="mt-4 inline-block text-primary text-sm font-medium">
          ← Overview
        </Link>
      </div>
    );
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
      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={runDelete}
        title="Delete platform user?"
        message={
          deleteTarget
            ? `Remove ${deleteTarget.name} (${deleteTarget.email}) from the platform team? They will lose access immediately.`
            : ''
        }
        confirmText="Delete"
        type="danger"
      />
      <PlatformOperatorUserModal
        open={modalOpen}
        mode={modalMode}
        userId={editId}
        catalog={catalog}
        currentUserId={me?.id || ''}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          loadUsers();
          loadCatalog();
        }}
        onError={(title, message) => showAlert('error', title, message)}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-gray">Platform team</h1>
          <p className="text-sm text-dark-gray-light mt-1">
            Invite FitNix staff, update their roles, and tune what each person is allowed to do on the platform.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={usersApiMissing}
          className="rounded-lg bg-purple px-4 py-2 text-sm font-medium text-white hover:bg-purple-dark disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add user
        </button>
      </div>

      {usersApiMissing && (
        <div className="mt-6 rounded-xl border border-info bg-info-light/20 p-4 text-sm text-dark-gray">
          <p className="font-semibold text-dark-gray">Platform team is not connected yet</p>
          <p className="mt-2 text-dark-gray-light">
            The screen loaded, but your server does not expose the <strong>platform users</strong> endpoints yet
            (you may see “route not found” or a 404). Ask your backend team to implement
            the APIs below — then refresh this page.
          </p>
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer font-medium text-primary">Copy prompt for backend / AI</summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-white p-3 border text-[11px] leading-relaxed whitespace-pre-wrap">
{`Implement FitNix PLATFORM operator user management under prefix /api/platform (same auth as existing platform routes: Bearer platform JWT from POST /api/platform/auth/login).

1) GET /api/platform/users
   Query (optional): search (name/email), role (SUPER_ADMIN | PLATFORM_SUPPORT), isActive (true|false), page, limit (max 100).
   Response: { success: true, data: { users: [...], pagination: { page, limit, total, totalPages } } }
   Each user: { id, email, name, role, isActive, permissionKeys: string[], createdAt?, updatedAt?, lastLoginAt? }
   Auth: SUPER_ADMIN and PLATFORM_SUPPORT may list (or restrict list to SUPER_ADMIN only — document choice).

2) GET /api/platform/users/:id
   Response: { success: true, data: { user: { ...same fields } } }

3) POST /api/platform/users  (SUPER_ADMIN only recommended)
   Body: { name, email, password?, role, isActive?, permissionKeys? }
   If password omitted, generate temp password and return { success: true, data: { user, generatedPassword } } once.

4) PATCH /api/platform/users/:id  (SUPER_ADMIN only)
   Partial body: name?, email?, role?, isActive?, permissionKeys?, password?
   Prevent removing last SUPER_ADMIN or locking out self without replacement.

5) DELETE /api/platform/users/:id  (SUPER_ADMIN only)
   Block delete self; block delete last SUPER_ADMIN.

6) GET /api/platform/permissions  (authenticated platform users)
   Response: { success: true, data: { permissions: [{ key, label, description?, group? }] } }
   Used by the portal for access checkboxes.

Errors: existing envelope { success: false, error: { code, message, details? } } with proper HTTP status (401, 403, 404, 409, 422).`}
            </pre>
          </details>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3 rounded-xl bg-white p-4 border border-light-gray-dark shadow">
        <input
          placeholder="Search name or email"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm flex-1 min-w-[12rem]"
        />
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">All roles</option>
          <option value="SUPER_ADMIN">Super admin</option>
          <option value="PLATFORM_SUPPORT">Support</option>
        </select>
        <button
          type="button"
          onClick={() => {
            setSearchApplied(searchDraft.trim());
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-white"
        >
          Apply
        </button>
      </div>

      {loading ? (
        <div className="mt-10 flex justify-center">
          <Loading message="Loading users…" size="md" />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-light-gray-dark bg-white shadow">
          <table className="min-w-full text-sm">
            <thead className="bg-light-gray text-left text-dark-gray-light">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Extra access</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const n = Array.isArray(u.permissionKeys) ? u.permissionKeys.length : 0;
                const isSelf = me && String(u.id) === String(me.id);
                return (
                  <tr key={String(u.id)} className="border-t border-light-gray">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-light-gray-dark/40 px-2 py-0.5 text-xs">
                        {humanizePlatformRole(String(u.role))}
                      </span>
                    </td>
                    <td className="px-4 py-3">{u.isActive === false ? 'No' : 'Yes'}</td>
                    <td className="px-4 py-3 text-xs text-dark-gray-light">
                      {n === 0 ? 'Role defaults only' : `${n} custom toggle${n === 1 ? '' : 's'}`}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      <button type="button" className="text-primary hover:underline" onClick={() => openEdit(u)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-error hover:underline disabled:opacity-40"
                        disabled={!!isSelf}
                        title={isSelf ? 'You cannot delete your own account here' : undefined}
                        onClick={() => setDeleteTarget(u)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-dark-gray-light">
                    No teammates match this search yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm">
        <button
          type="button"
          disabled={pagination.page <= 1}
          onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
          className="rounded border px-3 py-1 disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-dark-gray-light">
          Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
        </span>
        <button
          type="button"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
          className="rounded border px-3 py-1 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </>
  );
}

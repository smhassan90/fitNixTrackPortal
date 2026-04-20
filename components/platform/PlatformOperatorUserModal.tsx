'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PlatformOperatorUser, PlatformPermissionDefinition, PlatformRole } from '@/lib/platform/types';
import {
  createPlatformUser,
  getPlatformOperatorUser,
  updatePlatformUser,
} from '@/lib/platform/platformApi';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import GeneratedPasswordModal from '@/components/platform/GeneratedPasswordModal';

type Mode = 'create' | 'edit';

interface Props {
  open: boolean;
  mode: Mode;
  userId: string | number | null;
  catalog: PlatformPermissionDefinition[];
  currentUserId: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (title: string, message: string) => void;
}

export default function PlatformOperatorUserModal({
  open,
  mode,
  userId,
  catalog,
  currentUserId,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<PlatformRole>('PLATFORM_SUPPORT');
  const [isActive, setIsActive] = useState(true);
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const [genPw, setGenPw] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const m = new Map<string, PlatformPermissionDefinition[]>();
    for (const p of catalog) {
      const g = p.group || 'General';
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(p);
    }
    return Array.from(m.entries());
  }, [catalog]);

  useEffect(() => {
    if (!open) return;
    if (mode === 'create') {
      setName('');
      setEmail('');
      setPassword('');
      setRole('PLATFORM_SUPPORT');
      setIsActive(true);
      setPermissionKeys([]);
      return;
    }
    if (mode === 'edit' && userId == null) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getPlatformOperatorUser(userId as string | number);
        const u = data.user as PlatformOperatorUser;
        if (cancelled) return;
        setName(String(u.name ?? ''));
        setEmail(String(u.email ?? ''));
        setPassword('');
        setRole((u.role as PlatformRole) || 'PLATFORM_SUPPORT');
        setIsActive(u.isActive !== false);
        setPermissionKeys(Array.isArray(u.permissionKeys) ? [...u.permissionKeys] : []);
      } catch (e) {
        if (!cancelled) onError('Load user', mapPlatformErrorToUserMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mode, userId, onError]);

  const toggleKey = (key: string) => {
    setPermissionKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const submit = async () => {
    if (!name.trim() || !email.trim()) {
      onError('Validation', 'Name and email are required.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'create') {
        const body: Record<string, unknown> = {
          name: name.trim(),
          email: email.trim(),
          role,
          isActive,
          permissionKeys,
        };
        if (password.trim()) body.password = password.trim();
        const res = await createPlatformUser(body);
        if (res.generatedPassword) setGenPw(res.generatedPassword);
        onSaved();
        if (!res.generatedPassword) onClose();
      } else if (userId != null) {
        const body: Record<string, unknown> = {
          name: name.trim(),
          email: email.trim(),
          role,
          isActive,
          permissionKeys,
        };
        if (password.trim()) body.password = password.trim();
        await updatePlatformUser(userId, body);
        onSaved();
        onClose();
      }
    } catch (e) {
      onError(mode === 'create' ? 'Create failed' : 'Update failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <GeneratedPasswordModal
        open={!!genPw}
        password={genPw || ''}
        onClose={() => {
          setGenPw(null);
          onClose();
        }}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={() => !loading && onClose()} aria-hidden />
        <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl border border-light-gray-dark">
          <h2 className="text-lg font-bold text-dark-gray">
            {mode === 'create' ? 'Add platform user' : 'Edit platform user'}
          </h2>
          {mode === 'edit' && userId != null && String(userId) === String(currentUserId) && (
            <p className="mt-2 text-xs text-warning-dark">
              You are editing your own account. Avoid locking yourself out (role / active).
            </p>
          )}
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <label className="text-xs text-dark-gray-light">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-0.5 w-full rounded-lg border px-3 py-2"
                disabled={loading}
              />
            </div>
            <div>
              <label className="text-xs text-dark-gray-light">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-0.5 w-full rounded-lg border px-3 py-2"
                disabled={loading}
              />
            </div>
            <div>
              <label className="text-xs text-dark-gray-light">
                Password {mode === 'create' ? '(optional)' : '(leave blank to keep)'}
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-0.5 w-full rounded-lg border px-3 py-2"
                disabled={loading}
              />
            </div>
            <div>
              <label className="text-xs text-dark-gray-light">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as PlatformRole)}
                className="mt-0.5 w-full rounded-lg border px-3 py-2"
                disabled={loading}
              >
                <option value="SUPER_ADMIN">Super admin · full control</option>
                <option value="PLATFORM_SUPPORT">Support · mostly view-only</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Active
            </label>
          </div>

          <div className="mt-6 border-t pt-4">
            <h3 className="text-sm font-semibold text-dark-gray">Access</h3>
            <p className="text-xs text-dark-gray-light mt-1">
              Fine-tune what this teammate can see or change. Their role still sets the baseline — these toggles add
              or remove specific abilities.
            </p>
            {catalog.length === 0 ? (
              <p className="mt-2 text-xs text-dark-gray-light">
                No permission list returned yet. Once your administrator enables the catalog, checkboxes will appear
                here.
              </p>
            ) : (
              <div className="mt-3 space-y-4 max-h-48 overflow-y-auto pr-1">
                {grouped.map(([group, items]) => (
                  <div key={group}>
                    <p className="text-xs font-semibold text-dark-gray-light uppercase tracking-wide">{group}</p>
                    <ul className="mt-2 space-y-2">
                      {items.map((p) => (
                        <li key={p.key} className="flex gap-2 items-start" title={p.key}>
                          <input
                            type="checkbox"
                            checked={permissionKeys.includes(p.key)}
                            onChange={() => toggleKey(p.key)}
                            disabled={loading}
                            className="mt-1"
                          />
                          <div>
                            <span className="font-medium text-dark-gray">{p.label || p.key}</span>
                            {p.description && (
                              <p className="text-[11px] text-dark-gray-light">{p.description}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t pt-4">
            <button
              type="button"
              className="rounded-lg border px-4 py-2 text-sm"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-purple px-4 py-2 text-sm text-white disabled:opacity-50"
              onClick={submit}
              disabled={loading}
            >
              {loading ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

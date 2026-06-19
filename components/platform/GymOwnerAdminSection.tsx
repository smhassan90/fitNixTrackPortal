'use client';

import { useEffect, useState } from 'react';
import GeneratedPasswordModal from '@/components/platform/GeneratedPasswordModal';
import {
  createPlatformGymOwnerAdmin,
  patchPlatformGymOwnerAdmin,
  resetPlatformGymOwnerAdminPassword,
} from '@/lib/platform/platformApi';
import { mapPlatformErrorToUserMessage, PlatformApiError } from '@/lib/platform/errors';
import { getPlatformTokenBlockReason } from '@/lib/platform/platformSession';
import type { GymOwnerAdmin } from '@/lib/platform/types';

interface Props {
  gymId: string;
  ownerAdmin: GymOwnerAdmin | null;
  isSuper: boolean;
  onRefresh: () => void;
  onNotify: (type: 'success' | 'error' | 'warning', title: string, message: string) => void;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

export function normalizeGymOwnerAdmin(raw: unknown): GymOwnerAdmin | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.id == null || !o.email) return null;
  return {
    id: o.id as string | number,
    name: String(o.name ?? ''),
    email: String(o.email ?? ''),
    phone: o.phone != null && String(o.phone).trim() ? String(o.phone) : null,
    role: String(o.role ?? 'GYM_ADMIN'),
    isActive: o.isActive !== false,
    lastLoginAt: o.lastLoginAt != null ? String(o.lastLoginAt) : null,
    createdAt: o.createdAt != null ? String(o.createdAt) : undefined,
  };
}

function OwnerAdminInfo({ admin }: { admin: GymOwnerAdmin }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Name', value: admin.name || '—' },
    { label: 'Email', value: admin.email },
    { label: 'Phone', value: admin.phone || '—' },
    { label: 'Status', value: admin.isActive ? 'Active' : 'Inactive' },
    { label: 'Last login', value: formatDateTime(admin.lastLoginAt) },
    { label: 'Created', value: formatDate(admin.createdAt) },
  ];

  return (
    <dl className="space-y-2 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-4 border-b border-light-gray/80 pb-2">
          <dt className="text-dark-gray-light shrink-0">{row.label}</dt>
          <dd className="text-right font-medium text-dark-gray break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

type OwnerAdminDraft = {
  name: string;
  email: string;
  phone: string;
};

function draftKey(gymId: string) {
  return `fitnix_gym_owner_draft_${gymId}`;
}

function loadOwnerDraft(gymId: string): OwnerAdminDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(draftKey(gymId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OwnerAdminDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      name: String(parsed.name ?? ''),
      email: String(parsed.email ?? ''),
      phone: String(parsed.phone ?? ''),
    };
  } catch {
    return null;
  }
}

function saveOwnerDraft(gymId: string, draft: OwnerAdminDraft) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(draftKey(gymId), JSON.stringify(draft));
}

function clearOwnerDraft(gymId: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(draftKey(gymId));
}

function EditOwnerAdminForm({
  gymId,
  admin,
  onSaved,
  onNotify,
  onResetPassword,
}: {
  gymId: string;
  admin: GymOwnerAdmin;
  onSaved: () => void;
  onNotify: Props['onNotify'];
  onResetPassword: () => void;
}) {
  const [name, setName] = useState(admin.name);
  const [email, setEmail] = useState(admin.email);
  const [phone, setPhone] = useState(admin.phone ?? '');
  const [isActive, setIsActive] = useState(admin.isActive);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setName(admin.name);
    setEmail(admin.email);
    setPhone(admin.phone ?? '');
    setIsActive(admin.isActive);
  }, [admin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const tokenBlock = getPlatformTokenBlockReason();
    if (tokenBlock) {
      onNotify('warning', 'Session expired', tokenBlock);
      return;
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) {
      onNotify('error', 'Validation', 'Name is required.');
      return;
    }
    if (!trimmedEmail) {
      onNotify('error', 'Validation', 'Email is required.');
      return;
    }

    const body: { name?: string; email?: string; phone?: string | null; isActive?: boolean } = {};
    if (trimmedName !== admin.name) body.name = trimmedName;
    if (trimmedEmail !== admin.email.toLowerCase()) body.email = trimmedEmail;
    const trimmedPhone = phone.trim();
    const prevPhone = admin.phone ?? '';
    if (trimmedPhone !== prevPhone) body.phone = trimmedPhone || null;
    if (isActive !== admin.isActive) body.isActive = isActive;

    if (Object.keys(body).length === 0) {
      onNotify('warning', 'No changes', 'Update a field before saving.');
      return;
    }

    setSubmitting(true);
    try {
      await patchPlatformGymOwnerAdmin(gymId, body);
      onNotify('success', 'Saved', 'Gym admin details updated.');
      onSaved();
    } catch (err) {
      const msg = mapPlatformErrorToUserMessage(err);
      const status = err instanceof PlatformApiError ? err.status : undefined;
      if (status === 404 || (err instanceof PlatformApiError && err.code === 'NOT_FOUND')) {
        onNotify(
          'error',
          'API not available',
          msg ||
            'Update endpoint not deployed yet. Deploy backend PATCH /api/platform/gyms/:id/owner-admin.'
        );
      } else {
        onNotify('error', 'Update failed', msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-sm">
      <div className="rounded-lg border border-light-gray-dark bg-light-gray/40 px-3 py-2 text-xs text-dark-gray-light">
        <p>Last login: {formatDateTime(admin.lastLoginAt)}</p>
        <p>Created: {formatDate(admin.createdAt)}</p>
      </div>
      <div>
        <label className="text-xs text-dark-gray-light">Name *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded border px-2 py-1.5"
          autoComplete="off"
        />
      </div>
      <div>
        <label className="text-xs text-dark-gray-light">Login email *</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded border px-2 py-1.5"
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-dark-gray-light">Used at gym portal <span className="font-mono">/login</span>.</p>
      </div>
      <div>
        <label className="text-xs text-dark-gray-light">Phone</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded border px-2 py-1.5"
          autoComplete="off"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="rounded"
        />
        Account active (can sign in)
      </label>
      <div className="flex flex-wrap gap-2 pt-2 border-t border-light-gray-dark">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-primary px-4 py-2 text-white text-sm disabled:opacity-40"
        >
          {submitting ? 'Saving…' : 'Save details'}
        </button>
        <button
          type="button"
          onClick={onResetPassword}
          className="rounded-lg border border-warning px-4 py-2 text-sm text-warning-dark hover:bg-warning-light font-medium"
        >
          Reset password
        </button>
      </div>
    </form>
  );
}

function CreateOwnerAdminForm({
  gymId,
  disabled,
  onCreated,
  onNotify,
}: {
  gymId: string;
  disabled: boolean;
  onCreated: (generatedPassword?: string) => void;
  onNotify: Props['onNotify'];
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    const draft = loadOwnerDraft(gymId);
    if (!draft) return;
    setName(draft.name);
    setEmail(draft.email);
    setPhone(draft.phone);
    setDraftRestored(true);
  }, [gymId]);

  useEffect(() => {
    saveOwnerDraft(gymId, { name, email, phone });
  }, [gymId, name, email, phone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || submitting) return;

    const tokenBlock = getPlatformTokenBlockReason();
    if (tokenBlock) {
      onNotify('warning', 'Session expired', `${tokenBlock} Your form entries are saved in this tab.`);
      return;
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) {
      onNotify('error', 'Validation', 'Name is required.');
      return;
    }
    if (!trimmedEmail) {
      onNotify('error', 'Validation', 'Email is required.');
      return;
    }
    const trimmedPassword = password.trim();
    if (trimmedPassword && trimmedPassword.length < 8) {
      onNotify('error', 'Validation', 'Password must be at least 8 characters if set.');
      return;
    }

    setSubmitting(true);
    try {
      const body: { name: string; email: string; phone?: string; password?: string } = {
        name: trimmedName,
        email: trimmedEmail,
      };
      const trimmedPhone = phone.trim();
      if (trimmedPhone) body.phone = trimmedPhone;
      if (trimmedPassword) body.password = trimmedPassword;

      const data = await createPlatformGymOwnerAdmin(gymId, body);
      onNotify('success', 'Account created', 'Gym owner admin account created.');
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
      clearOwnerDraft(gymId);
      onCreated(data.generatedPassword);
    } catch (err) {
      const msg = mapPlatformErrorToUserMessage(err);
      const status = err instanceof PlatformApiError ? err.status : undefined;
      if (status === 409) {
        onNotify(
          'warning',
          'Owner already exists',
          msg || 'This gym already has an owner admin. Use reset password instead.'
        );
        onCreated();
      } else if (status === 404 || (err instanceof PlatformApiError && err.code === 'NOT_FOUND')) {
        onNotify(
          'error',
          'API not available',
          msg ||
            'The gym owner-admin API is not deployed on your backend yet. Deploy the latest FitNixTrackBackend (with /api/platform/gyms/:id/owner-admin), or point NEXT_PUBLIC_API_URL to a local backend running that code (http://localhost:3001).'
        );
      } else {
        onNotify('error', 'Create failed', msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`mt-4 space-y-3 text-sm ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <p className="text-sm text-dark-gray-light">
        No gym admin exists yet. Create the login the owner will use at{' '}
        <span className="font-mono text-xs">/login</span> (email + password).
      </p>
      {draftRestored && (
        <p className="text-xs text-primary">
          Restored your previous entries from this browser tab after sign-in.
        </p>
      )}
      <div>
        <label className="text-xs text-dark-gray-light">Name *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded border px-2 py-1.5"
          autoComplete="off"
        />
      </div>
      <div>
        <label className="text-xs text-dark-gray-light">Email *</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded border px-2 py-1.5"
          autoComplete="off"
        />
      </div>
      <div>
        <label className="text-xs text-dark-gray-light">Phone</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded border px-2 py-1.5"
          autoComplete="off"
        />
      </div>
      <div>
        <label className="text-xs text-dark-gray-light">Password (optional, min 8 if set)</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border px-2 py-1.5"
          autoComplete="new-password"
          minLength={8}
        />
        <p className="mt-1 text-xs text-dark-gray-light">
          Leave blank to auto-generate a password after creation.
        </p>
      </div>
      <button
        type="submit"
        disabled={disabled || submitting}
        className="rounded-lg bg-primary px-4 py-2 text-white text-sm disabled:opacity-40"
      >
        {submitting ? 'Creating…' : 'Create account'}
      </button>
    </form>
  );
}

function ResetPasswordDialog({
  open,
  gymId,
  ownerEmail,
  onClose,
  onReset,
  onNotify,
}: {
  open: boolean;
  gymId: string;
  ownerEmail: string;
  onClose: () => void;
  onReset: (generatedPassword?: string) => void;
  onNotify: Props['onNotify'];
}) {
  const [useCustomPassword, setUseCustomPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    if (submitting) return;
    setUseCustomPassword(false);
    setPassword('');
    onClose();
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const tokenBlock = getPlatformTokenBlockReason();
    if (tokenBlock) {
      onNotify('warning', 'Session expired', tokenBlock);
      return;
    }

    const trimmedPassword = password.trim();
    if (useCustomPassword) {
      if (!trimmedPassword) {
        onNotify('error', 'Validation', 'Enter a new password or turn off custom password to auto-generate.');
        return;
      }
      if (trimmedPassword.length < 8) {
        onNotify('error', 'Validation', 'Password must be at least 8 characters.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const body = useCustomPassword && trimmedPassword ? { password: trimmedPassword } : {};
      const data = await resetPlatformGymOwnerAdminPassword(gymId, body);
      onNotify('success', 'Password reset', 'Owner admin password has been reset.');
      setUseCustomPassword(false);
      setPassword('');
      onClose();
      onReset(data.generatedPassword);
    } catch (err) {
      const msg = mapPlatformErrorToUserMessage(err);
      const status = err instanceof PlatformApiError ? err.status : undefined;
      if (status === 404) {
        onNotify('error', 'Not found', msg || 'Create an owner admin first.');
      } else {
        onNotify('error', 'Reset failed', msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} aria-hidden />
      <div
        role="dialog"
        aria-modal
        className="relative z-10 max-w-md w-full rounded-xl bg-white p-6 shadow-2xl border border-light-gray-dark"
      >
        <h3 className="text-lg font-bold text-dark-gray">Reset owner password</h3>
        <p className="mt-2 text-sm text-dark-gray-light">
          Reset the gym login password for <strong>{ownerEmail}</strong>. The owner uses this at the gym portal, not
          the platform portal.
        </p>
        <label className="mt-4 flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={useCustomPassword}
            onChange={(e) => {
              setUseCustomPassword(e.target.checked);
              if (!e.target.checked) setPassword('');
            }}
            className="rounded"
          />
          Set custom password
        </label>
        {useCustomPassword && (
          <div className="mt-3">
            <label className="text-xs text-dark-gray-light">New password (min 8 characters)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              autoComplete="new-password"
              minLength={8}
            />
          </div>
        )}
        {!useCustomPassword && (
          <p className="mt-3 text-xs text-dark-gray-light">
            A new random password will be generated and shown once after reset.
          </p>
        )}
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="flex-1 rounded-lg border border-light-gray-dark px-4 py-2 text-sm hover:bg-light-gray disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 rounded-lg bg-warning px-4 py-2 text-white text-sm font-medium hover:bg-warning-dark disabled:opacity-50"
          >
            {submitting ? 'Resetting…' : 'Reset password'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GymOwnerAdminSection({ gymId, ownerAdmin, isSuper, onRefresh, onNotify }: Props) {
  const [resetOpen, setResetOpen] = useState(false);
  const [genPw, setGenPw] = useState<string | null>(null);

  const handlePasswordGenerated = (generatedPassword?: string) => {
    onRefresh();
    if (generatedPassword) {
      setGenPw(generatedPassword);
    }
  };

  return (
    <>
      <GeneratedPasswordModal
        open={Boolean(genPw)}
        password={genPw || ''}
        onClose={() => setGenPw(null)}
        title="Gym admin password"
        description={`Save this password now. It will not be shown again. The gym admin signs in at /login with email ${ownerAdmin?.email ?? ''} and this password.`}
      />

      <ResetPasswordDialog
        open={resetOpen}
        gymId={gymId}
        ownerEmail={ownerAdmin?.email ?? ''}
        onClose={() => setResetOpen(false)}
        onReset={handlePasswordGenerated}
        onNotify={onNotify}
      />

      <section className="rounded-xl bg-white p-4 shadow border border-light-gray-dark max-w-2xl">
        <h2 className="font-semibold">Gym admin account</h2>
        <p className="text-xs text-dark-gray-light mt-1">
          The gym owner&apos;s login for the gym app at <span className="font-mono">/login</span> — one account per
          gym. Not the same as your platform operator account at <span className="font-mono">/platform/login</span>.
        </p>

        {ownerAdmin ? (
          <>
            {isSuper ? (
              <EditOwnerAdminForm
                gymId={gymId}
                admin={ownerAdmin}
                onSaved={onRefresh}
                onNotify={onNotify}
                onResetPassword={() => setResetOpen(true)}
              />
            ) : (
              <div className="mt-4">
                <OwnerAdminInfo admin={ownerAdmin} />
                <p className="mt-4 text-sm text-dark-gray-light border-t border-light-gray-dark pt-4">
                  Only a super admin can edit gym admin details or reset the password.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            {isSuper ? (
              <CreateOwnerAdminForm
                gymId={gymId}
                disabled={!isSuper}
                onCreated={handlePasswordGenerated}
                onNotify={onNotify}
              />
            ) : (
              <p className="mt-4 text-sm text-dark-gray-light">
                No gym owner admin has been set up yet. Only a super admin can create one.
              </p>
            )}
          </>
        )}

        {genPw && (
          <p className="mt-4 rounded-lg border border-warning bg-warning-light/30 px-3 py-2 text-xs text-warning-dark">
            Save the generated password now — it will not be shown again after you close the dialog.
          </p>
        )}
      </section>
    </>
  );
}

'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  connectMarketingSocialAccount,
  disconnectMarketingSocialAccount,
  getMarketingOverview,
  listMarketingSocialAccounts,
  refreshMarketingSocialAccountStatus,
} from '@/lib/platform/marketingApi';
import type { MarketingSocialAccount } from '@/lib/platform/marketingTypes';
import { MARKETING_SOCIAL_PLATFORMS } from '@/lib/platform/marketingTypes';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import MarketingSubNav from '@/components/platform/marketing/MarketingSubNav';
import { SocialAccountStatusBadge } from '@/components/platform/marketing/MarketingStatusBadges';
import Loading from '@/components/Loading';
import Alert from '@/components/Alert';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { useAlert } from '@/hooks/useAlert';

function formatWhen(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function SocialMediaContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const gymId = String(params.gymId);
  const { alert, showAlert, closeAlert } = useAlert();
  const [gymName, setGymName] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [busyPlatform, setBusyPlatform] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<MarketingSocialAccount[]>([]);
  const [disconnectTarget, setDisconnectTarget] = useState<MarketingSocialAccount | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, overview] = await Promise.all([
        listMarketingSocialAccounts(gymId),
        getMarketingOverview(gymId).catch(() => null),
      ]);
      setAccounts(list.accounts || []);
      if (overview?.gym?.name) setGymName(overview.gym.name);
    } catch (e) {
      setAccounts([]);
      showAlert('error', 'Social accounts', mapPlatformErrorToUserMessage(e));
    } finally {
      setLoading(false);
    }
  }, [gymId, showAlert]);

  useEffect(() => {
    void load();
  }, [load]);

  // OAuth return: backend redirects here with ?oauth=success|error&platform=...
  useEffect(() => {
    const oauth = searchParams.get('oauth');
    if (!oauth) return;
    const platform = searchParams.get('platform') || 'account';
    const message = searchParams.get('message');
    if (oauth === 'success') {
      showAlert(
        'success',
        'Connected',
        `${platform.replace(/_/g, ' ')} connected successfully. Tokens are stored securely on the server.`
      );
      void load();
    } else if (oauth === 'error') {
      showAlert(
        'error',
        'Connection failed',
        message || `Could not connect ${platform.replace(/_/g, ' ')}. Try again.`
      );
    }
    router.replace(`/platform/marketing/${gymId}/social`, { scroll: false });
  }, [searchParams, gymId, load, router, showAlert]);

  const byPlatform = useMemo(() => {
    const map = new Map<string, MarketingSocialAccount[]>();
    for (const a of accounts) {
      const key = String(a.platform).toLowerCase();
      const list = map.get(key) || [];
      list.push(a);
      map.set(key, list);
    }
    return map;
  }, [accounts]);

  async function handleConnect(platform: string) {
    setBusyPlatform(platform);
    try {
      const returnPath = `/platform/marketing/${gymId}/social`;
      const result = await connectMarketingSocialAccount(gymId, platform, { returnPath });
      if (!result.authorizeUrl) {
        showAlert('error', 'Connect', 'No authorize URL returned from the server.');
        return;
      }
      window.location.assign(result.authorizeUrl);
    } catch (e) {
      showAlert('error', 'Connect failed', mapPlatformErrorToUserMessage(e));
      setBusyPlatform(null);
    }
  }

  async function handleDisconnect() {
    const target = disconnectTarget;
    setDisconnectTarget(null);
    if (!target) return;
    setBusyPlatform(String(target.platform));
    try {
      await disconnectMarketingSocialAccount(gymId, target.id);
      showAlert('success', 'Disconnected', `${target.accountName || target.platform} disconnected.`);
      await load();
    } catch (e) {
      showAlert('error', 'Disconnect failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setBusyPlatform(null);
    }
  }

  async function handleRefreshStatus(account: MarketingSocialAccount) {
    setBusyPlatform(`refresh-${account.id}`);
    try {
      const updated = await refreshMarketingSocialAccountStatus(gymId, account.id);
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      showAlert(
        updated.status === 'CONNECTED' ? 'success' : 'warning',
        'Status checked',
        updated.statusMessage ||
          (updated.status === 'CONNECTED'
            ? 'Connection looks healthy.'
            : 'Reconnect this account — authorization may have expired.')
      );
    } catch (e) {
      showAlert('error', 'Status check failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setBusyPlatform(null);
    }
  }

  if (loading) {
    return <Loading message="Loading social accounts…" fullScreen size="md" />;
  }

  return (
    <div>
      <MarketingSubNav gymId={gymId} gymName={gymName} />

      <Alert
        isOpen={alert.isOpen}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={closeAlert}
      />

      <ConfirmationDialog
        isOpen={!!disconnectTarget}
        title="Disconnect account?"
        message={
          disconnectTarget
            ? `Disconnect ${disconnectTarget.accountName || disconnectTarget.platform}? Publishing to this account will stop until you connect again. Tokens will be removed from the server.`
            : ''
        }
        confirmText="Disconnect"
        type="danger"
        onConfirm={() => void handleDisconnect()}
        onClose={() => setDisconnectTarget(null)}
      />

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-dark-gray">Connected accounts</h2>
        <p className="mt-1 text-sm text-dark-gray-light">
          Connect official OAuth accounts for this gym only. App credentials are configured in{' '}
          <Link href="/platform/marketing/settings" className="underline underline-offset-2">
            Marketing settings
          </Link>
          . Access tokens never appear in the browser. Gym owners cannot see or manage these
          connections.
        </p>
      </div>

      <div className="space-y-4">
        {MARKETING_SOCIAL_PLATFORMS.map((meta) => {
          const connected = (byPlatform.get(meta.id) || []).filter(
            (a) => a.status === 'CONNECTED' || a.status === 'ERROR' || a.status === 'PENDING'
          );
          const primary = connected[0];
          const isConnected = primary?.status === 'CONNECTED';
          const needsAttention = primary?.status === 'ERROR';
          const busy = busyPlatform === meta.id || busyPlatform === `refresh-${primary?.id}`;

          return (
            <section
              key={meta.id}
              className="rounded-xl border border-light-gray-dark bg-white p-5 shadow"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-dark-gray">{meta.label}</h3>
                    {!meta.available ? (
                      <span className="rounded-full bg-light-gray px-2 py-0.5 text-xs text-dark-gray-light">
                        Coming later
                      </span>
                    ) : primary ? (
                      <SocialAccountStatusBadge status={primary.status} />
                    ) : (
                      <SocialAccountStatusBadge status="DISCONNECTED" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-dark-gray-light">{meta.description}</p>

                  {primary && meta.available && (
                    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs uppercase text-dark-gray-light">Account / page</dt>
                        <dd className="font-medium text-dark-gray">
                          {primary.accountName || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase text-dark-gray-light">Connected</dt>
                        <dd className="text-dark-gray">{formatWhen(primary.connectedAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase text-dark-gray-light">
                          Last successful publish
                        </dt>
                        <dd className="text-dark-gray">{formatWhen(primary.lastPublishAt)}</dd>
                      </div>
                      {primary.tokenExpiresAt && (
                        <div>
                          <dt className="text-xs uppercase text-dark-gray-light">Token expires</dt>
                          <dd className="text-dark-gray">{formatWhen(primary.tokenExpiresAt)}</dd>
                        </div>
                      )}
                      {needsAttention && primary.statusMessage && (
                        <div className="sm:col-span-2">
                          <p className="rounded-lg border border-error/30 bg-error-light/10 px-3 py-2 text-sm text-error-dark">
                            {primary.statusMessage}
                          </p>
                        </div>
                      )}
                    </dl>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {!meta.available ? (
                    <button
                      type="button"
                      disabled
                      className="cursor-not-allowed rounded-lg border border-light-gray-dark px-4 py-2 text-sm text-dark-gray-light/60"
                    >
                      Unavailable
                    </button>
                  ) : isConnected || needsAttention ? (
                    <>
                      {needsAttention && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleConnect(meta.id)}
                          className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-60"
                        >
                          {busy ? 'Working…' : 'Reconnect'}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleRefreshStatus(primary)}
                        className="rounded-lg border border-light-gray-dark bg-white px-4 py-2 text-sm disabled:opacity-60"
                      >
                        Check status
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setDisconnectTarget(primary)}
                        className="rounded-lg border border-error/40 px-4 py-2 text-sm text-error-dark disabled:opacity-60"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleConnect(meta.id)}
                      className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-60"
                    >
                      {busy ? 'Redirecting…' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>

              {connected.length > 1 && (
                <ul className="mt-4 space-y-2 border-t border-light-gray-dark pt-4">
                  {connected.slice(1).map((extra) => (
                    <li
                      key={extra.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span className="text-dark-gray">
                        {extra.accountName || `Account #${extra.id}`}
                      </span>
                      <div className="flex items-center gap-2">
                        <SocialAccountStatusBadge status={extra.status} />
                        <button
                          type="button"
                          onClick={() => setDisconnectTarget(extra)}
                          className="text-xs text-error-dark underline-offset-2 hover:underline"
                        >
                          Disconnect
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function MarketingSocialPage() {
  return (
    <Suspense fallback={<Loading message="Loading social accounts…" fullScreen size="md" />}>
      <SocialMediaContent />
    </Suspense>
  );
}

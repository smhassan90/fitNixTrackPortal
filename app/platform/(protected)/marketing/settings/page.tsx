'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getMarketingPlatformSettings,
  updateMarketingPlatformSettings,
} from '@/lib/platform/marketingApi';
import type {
  MarketingOAuthAppSettings,
  MarketingPlatformSettings,
  MarketingPlatformSettingsUpdate,
  MarketingSecretField,
} from '@/lib/platform/marketingTypes';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import Loading from '@/components/Loading';
import Alert from '@/components/Alert';
import { useAlert } from '@/hooks/useAlert';

const OAUTH_ORDER = ['facebook', 'instagram', 'linkedin', 'google_business'] as const;

const OAUTH_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  google_business: 'Google Business Profile',
};

const inputClass =
  'w-full rounded-lg border border-light-gray-dark bg-white px-3 py-2 text-sm outline-none focus:border-primary';

function secretPlaceholder(field?: MarketingSecretField): string {
  if (field?.configured) {
    return field.hint ? `Stored (${field.hint}) — leave blank to keep` : 'Stored — leave blank to keep';
  }
  return 'Not configured';
}

function emptyOAuth(platform: string): MarketingOAuthAppSettings {
  return {
    platform,
    clientId: '',
    clientSecret: { configured: false, hint: null },
    redirectUri: '',
    enabled: false,
    notes: null,
  };
}

type AiDraft = {
  provider: string;
  textModel: string;
  imageModel: string;
  baseUrl: string;
  enabled: boolean;
  apiKey: string;
};

type OAuthDraft = {
  platform: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  enabled: boolean;
  notes: string;
  secretMeta: MarketingSecretField;
};

export default function MarketingSettingsPage() {
  const { alert, showAlert, closeAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiSecret, setAiSecret] = useState<MarketingSecretField>({ configured: false });
  const [ai, setAi] = useState<AiDraft>({
    provider: 'openai',
    textModel: '',
    imageModel: '',
    baseUrl: '',
    enabled: false,
    apiKey: '',
  });
  const [oauth, setOauth] = useState<OAuthDraft[]>([]);

  const applySettings = useCallback((data: MarketingPlatformSettings) => {
    setAiSecret(data.ai?.apiKey || { configured: false });
    setAi({
      provider: data.ai?.provider || 'openai',
      textModel: data.ai?.textModel || '',
      imageModel: data.ai?.imageModel || '',
      baseUrl: data.ai?.baseUrl || '',
      enabled: Boolean(data.ai?.enabled),
      apiKey: '',
    });
    const byPlatform = new Map(
      (data.oauthApps || []).map((a) => [String(a.platform).toLowerCase(), a])
    );
    setOauth(
      OAUTH_ORDER.map((platform) => {
        const row = byPlatform.get(platform) || emptyOAuth(platform);
        return {
          platform,
          clientId: row.clientId || '',
          clientSecret: '',
          redirectUri: row.redirectUri || '',
          enabled: Boolean(row.enabled),
          notes: row.notes || '',
          secretMeta: row.clientSecret || { configured: false },
        };
      })
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getMarketingPlatformSettings();
        if (!cancelled) applySettings(data);
      } catch (e) {
        if (!cancelled) {
          // Seed empty form so Super Admin can still fill once API exists
          applySettings({
            ai: {
              provider: 'openai',
              textModel: '',
              imageModel: '',
              apiKey: { configured: false },
              enabled: false,
            },
            oauthApps: OAUTH_ORDER.map((p) => emptyOAuth(p)),
          });
          showAlert('error', 'Marketing settings', mapPlatformErrorToUserMessage(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySettings, showAlert]);

  function updateOauth(platform: string, patch: Partial<OAuthDraft>) {
    setOauth((rows) => rows.map((r) => (r.platform === platform ? { ...r, ...patch } : r)));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: MarketingPlatformSettingsUpdate = {
        ai: {
          provider: ai.provider.trim() || 'openai',
          textModel: ai.textModel.trim(),
          imageModel: ai.imageModel.trim(),
          baseUrl: ai.baseUrl.trim() || null,
          enabled: ai.enabled,
          ...(ai.apiKey.trim() ? { apiKey: ai.apiKey.trim() } : {}),
        },
        oauthApps: oauth.map((row) => ({
          platform: row.platform,
          clientId: row.clientId.trim(),
          redirectUri: row.redirectUri.trim(),
          enabled: row.enabled,
          notes: row.notes.trim() || null,
          ...(row.clientSecret.trim() ? { clientSecret: row.clientSecret.trim() } : {}),
        })),
      };
      const saved = await updateMarketingPlatformSettings(body);
      applySettings(saved);
      showAlert(
        'success',
        'Settings saved',
        'Marketing credentials are stored in the database (encrypted). No marketing secrets belong in server env vars.'
      );
    } catch (err) {
      showAlert('error', 'Save failed', mapPlatformErrorToUserMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Loading message="Loading marketing settings…" fullScreen size="md" />;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-dark-gray-light">
            Marketing
          </p>
          <h1 className="text-2xl font-bold text-dark-gray">Settings</h1>
          <p className="mt-1 max-w-2xl text-sm text-dark-gray-light">
            Configure AI and social OAuth apps here. Values are stored in the database and managed
            only by Super Admin — not via backend environment variables. Secrets are never shown in
            full after save.
          </p>
        </div>
        <Link
          href="/platform/marketing"
          className="text-sm text-dark-gray-light underline-offset-2 hover:underline"
        >
          ← Gyms
        </Link>
      </div>

      <Alert
        isOpen={alert.isOpen}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={closeAlert}
      />

      <form onSubmit={handleSave} className="space-y-8">
        <section className="rounded-xl border border-light-gray-dark bg-white p-6 shadow">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-dark-gray">AI provider</h2>
              <p className="mt-1 text-xs text-dark-gray-light">
                Used for opportunities, social copy, image prompts, and image generation.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ai.enabled}
                onChange={(e) => setAi((a) => ({ ...a, enabled: e.target.checked }))}
              />
              Enabled
            </label>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-dark-gray">Provider</span>
              <input
                className={`${inputClass} mt-1.5`}
                value={ai.provider}
                onChange={(e) => setAi((a) => ({ ...a, provider: e.target.value }))}
                placeholder="openai"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-dark-gray">API key</span>
              <input
                className={`${inputClass} mt-1.5`}
                type="password"
                autoComplete="new-password"
                value={ai.apiKey}
                onChange={(e) => setAi((a) => ({ ...a, apiKey: e.target.value }))}
                placeholder={secretPlaceholder(aiSecret)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-dark-gray">Text model</span>
              <input
                className={`${inputClass} mt-1.5`}
                value={ai.textModel}
                onChange={(e) => setAi((a) => ({ ...a, textModel: e.target.value }))}
                placeholder="e.g. gpt-4.1-mini"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-dark-gray">Image model</span>
              <input
                className={`${inputClass} mt-1.5`}
                value={ai.imageModel}
                onChange={(e) => setAi((a) => ({ ...a, imageModel: e.target.value }))}
                placeholder="e.g. gpt-image-1"
              />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="font-medium text-dark-gray">Base URL (optional)</span>
              <input
                className={`${inputClass} mt-1.5`}
                value={ai.baseUrl}
                onChange={(e) => setAi((a) => ({ ...a, baseUrl: e.target.value }))}
                placeholder="Leave blank for provider default"
              />
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-dark-gray">Social OAuth apps</h2>
            <p className="mt-1 text-xs text-dark-gray-light">
              Platform app credentials for connecting gym Facebook/Instagram/LinkedIn/Google
              Business accounts. Per-gym connections stay under each gym’s Social Media page.
            </p>
          </div>

          {oauth.map((row) => (
            <div
              key={row.platform}
              className="rounded-xl border border-light-gray-dark bg-white p-6 shadow"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold text-dark-gray">
                  {OAUTH_LABELS[row.platform] || row.platform}
                </h3>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => updateOauth(row.platform, { enabled: e.target.checked })}
                  />
                  Enabled
                </label>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium text-dark-gray">Client ID / App ID</span>
                  <input
                    className={`${inputClass} mt-1.5`}
                    value={row.clientId}
                    onChange={(e) => updateOauth(row.platform, { clientId: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-dark-gray">Client secret</span>
                  <input
                    className={`${inputClass} mt-1.5`}
                    type="password"
                    autoComplete="new-password"
                    value={row.clientSecret}
                    onChange={(e) => updateOauth(row.platform, { clientSecret: e.target.value })}
                    placeholder={secretPlaceholder(row.secretMeta)}
                  />
                </label>
                <label className="block text-sm md:col-span-2">
                  <span className="font-medium text-dark-gray">OAuth redirect URI</span>
                  <span className="mt-0.5 block text-xs text-dark-gray-light">
                    Must match the callback URL registered with the provider (stored in DB).
                  </span>
                  <input
                    className={`${inputClass} mt-1.5`}
                    value={row.redirectUri}
                    onChange={(e) => updateOauth(row.platform, { redirectUri: e.target.value })}
                    placeholder="https://your-api.example.com/api/platform/marketing/oauth/facebook/callback"
                  />
                </label>
                <label className="block text-sm md:col-span-2">
                  <span className="font-medium text-dark-gray">Notes</span>
                  <input
                    className={`${inputClass} mt-1.5`}
                    value={row.notes}
                    onChange={(e) => updateOauth(row.platform, { notes: e.target.value })}
                    placeholder="Optional internal notes / required scopes"
                  />
                </label>
              </div>
            </div>
          ))}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary rounded-lg px-5 py-2.5 text-sm disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          <p className="text-xs text-dark-gray-light">
            Leave secret fields blank to keep the current stored value.
          </p>
        </div>
      </form>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  approveMarketingImageVersion,
  generateMarketingImage,
  generateMarketingImagePrompt,
  listMarketingImageVersions,
  regenerateMarketingImage,
  rejectMarketingImageVersion,
  updateMarketingContent,
} from '@/lib/platform/marketingApi';
import type {
  MarketingContent,
  MarketingImageVersion,
} from '@/lib/platform/marketingTypes';
import { mapPlatformErrorToUserMessage } from '@/lib/platform/errors';
import { ImageStatusBadge } from '@/components/platform/marketing/MarketingStatusBadges';
import ConfirmationDialog from '@/components/ConfirmationDialog';

const inputClass =
  'w-full rounded-lg border border-light-gray-dark bg-white px-3 py-2 text-sm outline-none focus:border-primary';
const areaClass = `${inputClass} min-h-[120px] resize-y`;

type Props = {
  contentId: string;
  gymId: string;
  content: MarketingContent;
  imageConcept: string;
  imagePrompt: string;
  editable: boolean;
  onConceptChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onContentUpdated: (content: MarketingContent) => void;
  onAlert: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
};

export default function MarketingImageWorkflow({
  contentId,
  content,
  imageConcept,
  imagePrompt,
  editable,
  onConceptChange,
  onPromptChange,
  onContentUpdated,
  onAlert,
}: Props) {
  const [versions, setVersions] = useState<MarketingImageVersion[]>(
    content.imageVersions || []
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [regenMode, setRegenMode] = useState<'quick' | 'custom' | null>(null);
  const [customInstructions, setCustomInstructions] = useState('');
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmGenerate, setConfirmGenerate] = useState(false);

  const syncFromContent = useCallback((c: MarketingContent) => {
    const list = c.imageVersions || [];
    setVersions(list);
    const approved = list.find((v) => v.status === 'APPROVED');
    const ready = list.find((v) => v.status === 'READY');
    setSelectedId((prev) => {
      if (prev && list.some((v) => v.id === prev)) return prev;
      return approved?.id ?? ready?.id ?? list[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    syncFromContent(content);
  }, [content, syncFromContent]);

  const selected = useMemo(
    () => versions.find((v) => v.id === selectedId) || null,
    [versions, selectedId]
  );

  async function refreshVersions(nextContent?: MarketingContent) {
    if (nextContent) {
      onContentUpdated(nextContent);
      syncFromContent(nextContent);
      return;
    }
    try {
      const data = await listMarketingImageVersions(contentId);
      setVersions(data.imageVersions || []);
    } catch (e) {
      onAlert('error', 'Images', mapPlatformErrorToUserMessage(e));
    }
  }

  async function savePromptOnly() {
    setBusy('save');
    try {
      const updated = await updateMarketingContent(contentId, {
        imageConcept: imageConcept || null,
        imagePrompt: imagePrompt || null,
      });
      onContentUpdated({ ...updated, imageVersions: versions });
      onAlert('success', 'Prompt saved', 'Image prompt saved. No image was generated.');
    } catch (e) {
      onAlert('error', 'Save failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleGeneratePrompt() {
    setBusy('prompt');
    try {
      const updated = await generateMarketingImagePrompt(contentId, {});
      onContentUpdated(updated);
      onConceptChange(updated.imageConcept || '');
      onPromptChange(updated.imagePrompt || '');
      onAlert(
        'success',
        'Prompt ready',
        'Review and edit the prompt, then click Generate Image. Nothing was published.'
      );
    } catch (e) {
      onAlert('error', 'Prompt generation failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleGenerateImage() {
    setConfirmGenerate(false);
    if (!imagePrompt.trim()) {
      onAlert('warning', 'Prompt required', 'Edit or generate an image prompt before generating.');
      return;
    }
    setBusy('generate');
    try {
      // Persist latest prompt first so generation uses what the Super Admin sees.
      await updateMarketingContent(contentId, {
        imageConcept: imageConcept || null,
        imagePrompt: imagePrompt.trim(),
      });
      const result = await generateMarketingImage(contentId, { prompt: imagePrompt.trim() });
      const merged: MarketingContent = {
        ...result.content,
        imageVersions: [
          result.imageVersion,
          ...(result.content.imageVersions || versions).filter(
            (v) => v.id !== result.imageVersion.id
          ),
        ],
      };
      await refreshVersions(merged);
      setSelectedId(result.imageVersion.id);
      onAlert(
        'success',
        'Image generated',
        'New version created. Approve, regenerate, or edit the prompt. Prior versions are kept.'
      );
    } catch (e) {
      onAlert('error', 'Image generation failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleRegenerate(mode: 'quick' | 'custom') {
    if (mode === 'custom' && !customInstructions.trim()) {
      onAlert('warning', 'Instructions required', 'Describe what to change for a custom regenerate.');
      return;
    }
    setRegenMode(null);
    setBusy('regen');
    try {
      const result = await regenerateMarketingImage(contentId, {
        mode,
        instructions: mode === 'custom' ? customInstructions.trim() : undefined,
        prompt: imagePrompt.trim() || undefined,
      });
      const merged: MarketingContent = {
        ...result.content,
        imageVersions: [
          result.imageVersion,
          ...(result.content.imageVersions || versions).filter(
            (v) => v.id !== result.imageVersion.id
          ),
        ],
      };
      if (result.content.imagePrompt) onPromptChange(result.content.imagePrompt);
      await refreshVersions(merged);
      setSelectedId(result.imageVersion.id);
      setCustomInstructions('');
      onAlert('success', 'Regenerated', 'A new image version was added. Previous versions remain.');
    } catch (e) {
      onAlert('error', 'Regenerate failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleApprove() {
    setConfirmApprove(false);
    if (!selected) return;
    setBusy('approve');
    try {
      const result = await approveMarketingImageVersion(contentId, selected.id);
      const list =
        result.content.imageVersions ||
        versions.map((v) =>
          v.id === result.imageVersion.id
            ? result.imageVersion
            : v.status === 'APPROVED'
              ? { ...v, status: 'REJECTED' as const }
              : v
        );
      await refreshVersions({ ...result.content, imageVersions: list });
      onAlert('success', 'Image approved', 'This version is approved for later publishing steps.');
    } catch (e) {
      onAlert('error', 'Approve failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleRejectSelected() {
    if (!selected) return;
    setBusy('reject');
    try {
      const result = await rejectMarketingImageVersion(contentId, selected.id);
      const list =
        result.content.imageVersions ||
        versions.map((v) => (v.id === result.imageVersion.id ? result.imageVersion : v));
      await refreshVersions({ ...result.content, imageVersions: list });
      onAlert('success', 'Image rejected', 'You can regenerate or pick another version.');
    } catch (e) {
      onAlert('error', 'Reject failed', mapPlatformErrorToUserMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const disabled = !!busy || !editable;

  return (
    <section className="rounded-xl border border-light-gray-dark bg-white p-6 shadow">
      <h3 className="font-semibold text-dark-gray">Image workflow</h3>
      <p className="mt-1 text-xs text-dark-gray-light">
        1) Review/edit prompt → 2) Generate Image → 3) Approve or regenerate. Versions are never
        overwritten. Nothing publishes from this screen.
      </p>

      <ConfirmationDialog
        isOpen={confirmGenerate}
        title="Generate image?"
        message="Uses the prompt below. Creates a new version; previous versions stay in history."
        confirmText={busy === 'generate' ? 'Generating…' : 'Generate Image'}
        type="info"
        onConfirm={() => void handleGenerateImage()}
        onClose={() => setConfirmGenerate(false)}
      />
      <ConfirmationDialog
        isOpen={confirmApprove}
        title="Approve this image version?"
        message="Marks this version as the approved creative for later publish steps. Does not post to social."
        confirmText="Approve Image"
        type="info"
        onConfirm={() => void handleApprove()}
        onClose={() => setConfirmApprove(false)}
      />

      {regenMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => !busy && setRegenMode(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-light-gray-dark bg-white p-6 shadow-xl">
            <h4 className="text-lg font-semibold text-dark-gray">
              {regenMode === 'quick' ? 'Quick regenerate' : 'Custom prompt modification'}
            </h4>
            <p className="mt-2 text-sm text-dark-gray-light">
              {regenMode === 'quick'
                ? 'Slightly varies the existing prompt and generates a new image version.'
                : 'Describe changes (e.g. brighter lighting, wider angle). A new version will be created.'}
            </p>
            {regenMode === 'custom' && (
              <textarea
                className={`${areaClass} mt-3`}
                placeholder="Remove dumbbells from the foreground. Make lighting brighter…"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
              />
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={!!busy}
                onClick={() => setRegenMode(null)}
                className="rounded-lg border border-light-gray-dark px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void handleRegenerate(regenMode)}
                className="btn-primary rounded-lg px-3 py-2 text-sm disabled:opacity-60"
              >
                {busy === 'regen' ? 'Regenerating…' : 'Regenerate'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-dark-gray">Image concept</span>
          <textarea
            className={`${areaClass} mt-1.5`}
            value={imageConcept}
            disabled={disabled}
            onChange={(e) => onConceptChange(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-dark-gray">Image-generation prompt</span>
          <span className="mt-0.5 block text-xs text-dark-gray-light">
            Super Admin must review/edit this before generating pixels.
          </span>
          <textarea
            className={`${areaClass} mt-1.5`}
            value={imagePrompt}
            disabled={disabled}
            onChange={(e) => onPromptChange(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => void savePromptOnly()}
          className="rounded-lg border border-light-gray-dark bg-white px-3 py-2 text-sm disabled:opacity-60"
        >
          {busy === 'save' ? 'Saving…' : 'Save Prompt'}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void handleGeneratePrompt()}
          className="rounded-lg border border-light-gray-dark bg-white px-3 py-2 text-sm disabled:opacity-60"
        >
          {busy === 'prompt' ? 'Generating prompt…' : 'Generate Image Prompt'}
        </button>
        <button
          type="button"
          disabled={disabled || !imagePrompt.trim()}
          onClick={() => setConfirmGenerate(true)}
          className="btn-primary rounded-lg px-3 py-2 text-sm disabled:opacity-60"
        >
          {busy === 'generate' ? 'Generating image…' : 'Generate Image'}
        </button>
      </div>

      {(busy === 'generate' || busy === 'regen') && (
        <p className="mt-3 text-sm text-dark-gray-light">
          Generating image… this can take a moment. Your draft copy is safe.
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          <h4 className="text-sm font-semibold text-dark-gray">Preview</h4>
          <div className="mt-2 flex min-h-[240px] items-center justify-center overflow-hidden rounded-xl border border-light-gray-dark bg-[#f8f8f8]">
            {selected?.imageUrl && selected.status !== 'FAILED' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.imageUrl}
                alt={`Image version ${selected.id}`}
                className="max-h-[420px] w-full object-contain"
              />
            ) : selected?.status === 'FAILED' ? (
              <p className="p-6 text-center text-sm text-error-dark">
                This version failed. Regenerate or edit the prompt.
              </p>
            ) : selected?.status === 'PENDING' ? (
              <p className="p-6 text-center text-sm text-dark-gray-light">Generation pending…</p>
            ) : (
              <p className="p-6 text-center text-sm text-dark-gray-light">
                No image yet. Review the prompt, then Generate Image.
              </p>
            )}
          </div>

          {selected && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ImageStatusBadge status={selected.status} />
              <span className="text-xs text-dark-gray-light">Version #{selected.id}</span>
              {(selected.status === 'READY' || selected.status === 'REJECTED') && editable && (
                <>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => setConfirmApprove(true)}
                    className="rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-60"
                  >
                    Approve Image
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => setRegenMode('quick')}
                    className="rounded-lg border border-light-gray-dark px-3 py-1.5 text-xs disabled:opacity-60"
                  >
                    Quick Regenerate
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => setRegenMode('custom')}
                    className="rounded-lg border border-light-gray-dark px-3 py-1.5 text-xs disabled:opacity-60"
                  >
                    Custom Regenerate
                  </button>
                  {selected.status === 'READY' && (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => void handleRejectSelected()}
                      className="rounded-lg border border-error/40 px-3 py-1.5 text-xs text-error-dark disabled:opacity-60"
                    >
                      Reject
                    </button>
                  )}
                </>
              )}
              {selected.status === 'APPROVED' && editable && (
                <>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => setRegenMode('quick')}
                    className="rounded-lg border border-light-gray-dark px-3 py-1.5 text-xs disabled:opacity-60"
                  >
                    Quick Regenerate
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => setRegenMode('custom')}
                    className="rounded-lg border border-light-gray-dark px-3 py-1.5 text-xs disabled:opacity-60"
                  >
                    Custom Regenerate
                  </button>
                </>
              )}
            </div>
          )}

          {selected?.modifiedPrompt && (
            <p className="mt-3 text-xs text-dark-gray-light">
              <span className="font-medium text-dark-gray">Prompt used: </span>
              {selected.modifiedPrompt || selected.prompt}
            </p>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-dark-gray">Version history</h4>
          <p className="mt-1 text-xs text-dark-gray-light">Newest first. Nothing is overwritten.</p>
          <ul className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
            {versions.length === 0 ? (
              <li className="rounded-lg border border-dashed border-light-gray-dark px-3 py-4 text-center text-xs text-dark-gray-light">
                No versions yet
              </li>
            ) : (
              versions.map((v, index) => {
                const active = v.id === selectedId;
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(v.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                        active
                          ? 'border-primary bg-primary/10'
                          : 'border-light-gray-dark bg-white hover:bg-[#f8f8f8]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-dark-gray">
                          v{versions.length - index}
                          {v.status === 'APPROVED' ? ' ✓' : ''}
                        </span>
                        <ImageStatusBadge status={v.status} />
                      </div>
                      <p className="mt-1 truncate text-dark-gray-light">
                        {v.createdAt
                          ? new Date(v.createdAt).toLocaleString()
                          : `Version #${v.id}`}
                      </p>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

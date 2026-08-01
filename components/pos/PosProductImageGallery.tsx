'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import {
  POS_PRODUCT_IMAGE_ACCEPT,
  POS_PRODUCT_MAX_IMAGES,
  deletePosProductGalleryImage,
  posProductImageErrorMessage,
  reorderPosProductImages,
  resolveProductImageUrl,
  setPosProductImageFeatured,
  uploadPosProductImages,
  validatePosProductImageFile,
} from '@/lib/pos/productImage';
import type { PosProductImage } from '@/lib/pos/types';

export type PendingPosProductImage = {
  key: string;
  file: File;
  previewUrl: string;
  featured: boolean;
};

type Props = {
  productId?: string | number | null;
  images: PosProductImage[];
  imageUrl?: string | null;
  disabled?: boolean;
  /** Called after server gallery mutations with the latest images + featured url. */
  onGalleryChange?: (next: { images: PosProductImage[]; imageUrl: string | null }) => void;
  /** Create flow: pending local files (uploaded after product save). */
  pendingImages?: PendingPosProductImage[];
  onPendingImagesChange?: (next: PendingPosProductImage[]) => void;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
};

function sortImages(list: PosProductImage[]): PosProductImage[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

export default function PosProductImageGallery({
  productId,
  images,
  imageUrl,
  disabled = false,
  onGalleryChange,
  pendingImages = [],
  onPendingImagesChange,
  onError,
  onSuccess,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localImages, setLocalImages] = useState(() => sortImages(images));
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PosProductImage | null>(null);
  const [deletePendingKey, setDeletePendingKey] = useState<string | null>(null);

  const canUploadNow = productId != null && productId !== '';

  useEffect(() => {
    setLocalImages(sortImages(images));
  }, [images]);

  useEffect(() => {
    return () => {
      for (const p of pendingImages) URL.revokeObjectURL(p.previewUrl);
    };
    // Only revoke on unmount of current pending set when parent clears — avoid double-revoke on reorder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const featuredUrl = useMemo(() => {
    const featured = localImages.find((i) => i.isFeatured)?.url ?? imageUrl ?? localImages[0]?.url;
    return resolveProductImageUrl(featured ?? null);
  }, [localImages, imageUrl]);

  const slotCount = canUploadNow ? localImages.length : pendingImages.length;
  const remaining = Math.max(0, POS_PRODUCT_MAX_IMAGES - slotCount);
  const addDisabled = disabled || busy || remaining <= 0;

  const applyServerResult = (result: {
    images: PosProductImage[];
    imageUrl: string | null;
  }) => {
    const next = sortImages(result.images);
    setLocalImages(next);
    onGalleryChange?.({ images: next, imageUrl: result.imageUrl });
  };

  const onFilesChosen = async (fileList: FileList | null) => {
    if (!fileList?.length || addDisabled) return;
    const picked = Array.from(fileList).slice(0, remaining);
    for (const file of picked) {
      const err = validatePosProductImageFile(file);
      if (err) {
        onError?.(err);
        if (inputRef.current) inputRef.current.value = '';
        return;
      }
    }

    if (!canUploadNow) {
      const next: PendingPosProductImage[] = [...pendingImages];
      for (const file of picked) {
        if (next.length >= POS_PRODUCT_MAX_IMAGES) break;
        next.push({
          key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
          file,
          previewUrl: URL.createObjectURL(file),
          featured: next.length === 0,
        });
      }
      // Ensure exactly one featured among pending
      if (next.length && !next.some((p) => p.featured)) next[0].featured = true;
      onPendingImagesChange?.(next);
      onSuccess?.(
        next.length === 1
          ? 'Image ready. It will upload when you save the product.'
          : `${picked.length} image(s) ready. They will upload when you save the product.`
      );
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    try {
      setBusy(true);
      const makeFeatured = localImages.length === 0;
      const result = await uploadPosProductImages(productId!, picked, {
        isFeatured: makeFeatured,
      });
      applyServerResult(result);
      onSuccess?.(
        result.added != null
          ? `Added ${result.added} image(s).`
          : `Uploaded ${picked.length} image(s).`
      );
    } catch (e) {
      onError?.(posProductImageErrorMessage(e));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleSetFeatured = async (image: PosProductImage) => {
    if (!canUploadNow || busy || image.isFeatured) return;
    try {
      setBusy(true);
      const result = await setPosProductImageFeatured(productId!, image.id);
      applyServerResult(result);
      onSuccess?.('Featured image updated.');
    } catch (e) {
      onError?.(posProductImageErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (deletePendingKey) {
      const next = pendingImages.filter((p) => p.key !== deletePendingKey);
      const removed = pendingImages.find((p) => p.key === deletePendingKey);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      if (next.length && !next.some((p) => p.featured)) next[0].featured = true;
      onPendingImagesChange?.(next);
      setDeletePendingKey(null);
      onSuccess?.('Image removed.');
      return;
    }
    if (!deleteTarget || !canUploadNow) return;
    try {
      setBusy(true);
      const result = await deletePosProductGalleryImage(productId!, deleteTarget.id);
      applyServerResult(result);
      onSuccess?.('Image deleted.');
    } catch (e) {
      onError?.(posProductImageErrorMessage(e));
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  };

  const handleDropReorder = async (targetId: number) => {
    if (dragId == null || dragId === targetId || !canUploadNow || busy) {
      setDragId(null);
      return;
    }
    const ids = localImages.map((i) => i.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) {
      setDragId(null);
      return;
    }
    const nextIds = [...ids];
    const [moved] = nextIds.splice(from, 1);
    nextIds.splice(to, 0, moved);
    // Optimistic UI
    const byId = new Map(localImages.map((i) => [i.id, i]));
    setLocalImages(
      nextIds.map((id, sortOrder) => ({
        ...(byId.get(id) as PosProductImage),
        sortOrder,
      }))
    );
    setDragId(null);
    try {
      setBusy(true);
      const result = await reorderPosProductImages(productId!, nextIds);
      applyServerResult(result);
      onSuccess?.('Gallery order saved.');
    } catch (e) {
      setLocalImages(sortImages(images));
      onError?.(posProductImageErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const setPendingFeatured = (key: string) => {
    onPendingImagesChange?.(
      pendingImages.map((p) => ({ ...p, featured: p.key === key }))
    );
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4 sm:col-span-2">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-dark-gray">Product images</p>
          <p className="text-xs text-gray-500">
            Up to {POS_PRODUCT_MAX_IMAGES} photos. One featured image is used as the thumbnail.
          </p>
        </div>
        <button
          type="button"
          disabled={addDisabled}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Working…' : remaining <= 0 ? 'Limit reached (5)' : 'Add images'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={POS_PRODUCT_IMAGE_ACCEPT}
        multiple
        className="hidden"
        disabled={addDisabled}
        onChange={(e) => void onFilesChosen(e.target.files)}
      />

      {canUploadNow ? (
        localImages.length === 0 ? (
          <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-sm text-gray-400">
            No images yet
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {localImages.map((img) => {
              const src = resolveProductImageUrl(img.url);
              return (
                <li
                  key={img.id}
                  draggable={!disabled && !busy}
                  onDragStart={() => setDragId(img.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => void handleDropReorder(img.id)}
                  className={`relative overflow-hidden rounded-xl border bg-white shadow-sm ${
                    img.isFeatured ? 'border-primary ring-1 ring-primary/30' : 'border-gray-200'
                  } ${dragId === img.id ? 'opacity-60' : ''}`}
                >
                  <div className="aspect-square bg-gray-100">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  {img.isFeatured && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-ink">
                      Featured
                    </span>
                  )}
                  <div className="flex flex-wrap gap-1 border-t border-gray-100 p-1.5">
                    {!img.isFeatured && (
                      <button
                        type="button"
                        disabled={disabled || busy}
                        onClick={() => void handleSetFeatured(img)}
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                      >
                        Set featured
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={disabled || busy}
                      onClick={() => setDeleteTarget(img)}
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                    <span className="ml-auto self-center text-[10px] text-gray-400">Drag</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : pendingImages.length === 0 ? (
        <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-sm text-gray-400">
          No images yet — uploads after you save
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {pendingImages.map((p) => (
            <li
              key={p.key}
              className={`relative overflow-hidden rounded-xl border bg-white shadow-sm ${
                p.featured ? 'border-primary ring-1 ring-primary/30' : 'border-gray-200'
              }`}
            >
              <div className="aspect-square bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
              </div>
              {p.featured && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-ink">
                  Featured
                </span>
              )}
              <div className="flex flex-wrap gap-1 border-t border-gray-100 p-1.5">
                {!p.featured && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setPendingFeatured(p.key)}
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
                  >
                    Set featured
                  </button>
                )}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setDeletePendingKey(p.key)}
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {featuredUrl && canUploadNow && localImages.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          Featured thumbnail is used on product cards and catalogs.
        </p>
      )}

      <ConfirmationDialog
        isOpen={Boolean(deleteTarget) || Boolean(deletePendingKey)}
        onClose={() => {
          setDeleteTarget(null);
          setDeletePendingKey(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Remove image"
        message="Remove this product image from the gallery?"
        confirmText="Remove"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}

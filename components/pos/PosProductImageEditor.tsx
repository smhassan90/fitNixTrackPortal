'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import {
  deletePosProductImage,
  posProductImageErrorMessage,
  resolveProductImageUrl,
  uploadPosProductImage,
} from '@/lib/pos/productImage';

const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_PICK_BYTES = 8 * 1024 * 1024;

type Props = {
  /** When set, choosing a file uploads immediately. When omitted, blob is held until product is saved. */
  productId?: string | number | null;
  imageUrl: string | null;
  disabled?: boolean;
  onImageUrlChange: (url: string | null) => void;
  onPendingImageChange?: (blob: Blob | null) => void;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
};

export default function PosProductImageEditor({
  productId,
  imageUrl,
  disabled = false,
  onImageUrlChange,
  onPendingImageChange,
  onError,
  onSuccess,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localUrl, setLocalUrl] = useState(imageUrl);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const canUploadNow = productId != null && productId !== '';

  useEffect(() => {
    setLocalUrl(imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  const displayUrl = useMemo(() => {
    if (pendingPreviewUrl) return pendingPreviewUrl;
    return resolveProductImageUrl(localUrl);
  }, [localUrl, pendingPreviewUrl]);

  const busy = disabled || uploading;
  const hasImage = Boolean(displayUrl);

  const clearPendingPreview = () => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingPreviewUrl(null);
  };

  const onFileChosen = async (file: File | undefined) => {
    if (!file || busy) return;
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const okExt = /\.(jpe?g|png|webp)$/i.test(file.name);
    if ((file.type && !allowed.has(file.type) && !okExt) || (!file.type && !okExt)) {
      onError?.('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_PICK_BYTES) {
      onError?.('That image is too large. Use a photo under 8 MB.');
      return;
    }

    if (!canUploadNow) {
      clearPendingPreview();
      setPendingPreviewUrl(URL.createObjectURL(file));
      onPendingImageChange?.(file);
      onImageUrlChange(null);
      onSuccess?.('Image ready. It will upload when you save the product.');
      return;
    }

    try {
      setUploading(true);
      const ext = file.name.match(/\.(jpe?g|png|webp)$/i)?.[1]?.toLowerCase() || 'jpg';
      const normalizedExt = ext === 'jpeg' ? 'jpg' : ext;
      const result = await uploadPosProductImage(productId!, file, `product.${normalizedExt}`);
      clearPendingPreview();
      onPendingImageChange?.(null);
      const next = result.imageUrl;
      setLocalUrl(next);
      onImageUrlChange(next);
      onSuccess?.('Product image updated.');
    } catch (e) {
      onError?.(posProductImageErrorMessage(e));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!canUploadNow) {
      clearPendingPreview();
      onPendingImageChange?.(null);
      onImageUrlChange(null);
      setRemoveOpen(false);
      onSuccess?.('Image removed.');
      return;
    }

    try {
      setUploading(true);
      await deletePosProductImage(productId!);
      clearPendingPreview();
      onPendingImageChange?.(null);
      setLocalUrl(null);
      onImageUrlChange(null);
      onSuccess?.('Product image removed.');
    } catch (e) {
      onError?.(posProductImageErrorMessage(e));
    } finally {
      setUploading(false);
      setRemoveOpen(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4 sm:col-span-2">
      <p className="mb-3 text-sm font-medium text-gray-800">Product image</p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-white bg-white shadow-sm">
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayUrl!} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center text-xs text-gray-400">No image</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : hasImage ? 'Change image' : 'Upload image'}
          </button>
          {hasImage && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setRemoveOpen(true)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        disabled={busy}
        onChange={(e) => void onFileChosen(e.target.files?.[0])}
      />
      {!canUploadNow && (
        <p className="mt-2 text-xs text-gray-500">Image uploads when you save a new product.</p>
      )}
      <ConfirmationDialog
        isOpen={removeOpen}
        onClose={() => setRemoveOpen(false)}
        onConfirm={handleRemove}
        title="Remove image"
        message="Remove this product image?"
        confirmText="Remove"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}

import { getErrorMessage } from '@/lib/errorHandler';
import { resolveMediaUrl } from '@/lib/resolveMediaUrl';
import { normalizeProductImages } from '@/lib/pos/posApi';
import type { PosProductImage } from '@/lib/pos/types';

export { resolveMediaUrl as resolveProductImageUrl };

export const POS_PRODUCT_MAX_IMAGES = 5;
export const POS_PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const POS_PRODUCT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

export function pickProductImageUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.imageUrl === 'string' && data.imageUrl.trim()) return data.imageUrl.trim();
  if (typeof data.image === 'string' && data.image.trim()) return data.image.trim();
  const image = data.image;
  if (image && typeof image === 'object') {
    const url = (image as { url?: unknown }).url;
    if (typeof url === 'string' && url.trim()) return url.trim();
  }
  const images = normalizeProductImages(data.images);
  return images.find((i) => i.isFeatured)?.url ?? images[0]?.url ?? null;
}

export type PosProductGalleryResult = {
  imageUrl: string | null;
  images: PosProductImage[];
  maxImages: number;
  added?: number;
};

function gymAuthHeaders(includeJson = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (includeJson) headers['Content-Type'] = 'application/json';
  if (typeof window === 'undefined') return headers;
  const token = localStorage.getItem('token');
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const user = JSON.parse(storedUser) as { gymId?: string | number };
      if (user.gymId != null) headers['X-Gym-Id'] = String(user.gymId);
    }
  } catch {
    /* ignore */
  }
  return headers;
}

async function parseJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || data.success === false) {
    const err = data.error as { message?: string } | undefined;
    throw new Error(
      err?.message ||
        (typeof data.message === 'string' ? data.message : '') ||
        `Request failed (${res.status})`
    );
  }
  return data;
}

function unwrapGalleryPayload(payload: Record<string, unknown>): PosProductGalleryResult {
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const product = (data.product ?? data) as Record<string, unknown>;
  const images = normalizeProductImages(data.images ?? product.images);
  const imageUrl =
    pickProductImageUrl(data) ||
    pickProductImageUrl(product) ||
    images.find((i) => i.isFeatured)?.url ||
    images[0]?.url ||
    null;
  const maxImages =
    typeof data.maxImages === 'number' && data.maxImages > 0
      ? data.maxImages
      : POS_PRODUCT_MAX_IMAGES;
  return {
    imageUrl,
    images,
    maxImages,
    added: typeof data.added === 'number' ? data.added : undefined,
  };
}

export function posProductImageErrorMessage(error: unknown): string {
  const raw =
    (error as { message?: string })?.message ||
    (error instanceof Error ? error.message : '') ||
    getErrorMessage(error);
  const msg = String(raw || '');
  if (/too large|file size|max.*size|5\s*mb|8\s*mb|payload/i.test(msg)) {
    return 'That image is too large. Use a photo under 5 MB.';
  }
  if (/invalid.*(type|image|format)|mime|jpeg|png|webp/i.test(msg)) {
    return 'Please choose a JPEG, PNG, or WebP image.';
  }
  if (/max.*5|limit.*5|too many|maximum.*image/i.test(msg)) {
    return 'A product can have at most 5 images.';
  }
  return msg || 'Could not update product images. Please try again.';
}

export function validatePosProductImageFile(file: File): string | null {
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const okExt = /\.(jpe?g|png|webp)$/i.test(file.name);
  if ((file.type && !allowed.has(file.type) && !okExt) || (!file.type && !okExt)) {
    return 'Please choose a JPEG, PNG, or WebP image.';
  }
  if (file.size > POS_PRODUCT_IMAGE_MAX_BYTES) {
    return 'That image is too large. Use a photo under 5 MB.';
  }
  return null;
}

/** GET /api/pos/products/:id/images */
export async function fetchPosProductImages(
  productId: string | number
): Promise<PosProductGalleryResult> {
  const res = await fetch(`/api/pos/products/${productId}/images`, {
    headers: gymAuthHeaders(true),
  });
  const payload = await parseJsonResponse(res);
  return unwrapGalleryPayload(payload);
}

/**
 * POST multipart gallery upload.
 * Field name `images` (File[]) preferred; sets isFeatured on first file when requested.
 */
export async function uploadPosProductImages(
  productId: string | number,
  files: File[],
  opts?: { isFeatured?: boolean }
): Promise<PosProductGalleryResult> {
  if (!files.length) throw new Error('No images selected.');
  const formData = new FormData();
  for (const file of files) {
    formData.append('images', file, file.name || 'product.jpg');
  }
  if (opts?.isFeatured) formData.append('isFeatured', 'true');

  const res = await fetch(`/api/pos/products/${productId}/images`, {
    method: 'POST',
    headers: gymAuthHeaders(false),
    body: formData,
  });
  const payload = await parseJsonResponse(res);
  return unwrapGalleryPayload(payload);
}

/** Legacy single featured upload (kept for compatibility). */
export async function uploadPosProductImage(
  productId: string | number,
  blob: Blob,
  filename = 'product.jpg'
): Promise<{ imageUrl: string | null }> {
  const file =
    blob instanceof File
      ? blob
      : new File([blob], filename, { type: blob.type || 'image/jpeg' });
  const result = await uploadPosProductImages(productId, [file], { isFeatured: true });
  return { imageUrl: result.imageUrl };
}

export async function setPosProductImageFeatured(
  productId: string | number,
  imageId: number
): Promise<PosProductGalleryResult> {
  const res = await fetch(`/api/pos/products/${productId}/images/${imageId}/feature`, {
    method: 'POST',
    headers: gymAuthHeaders(true),
  });
  const payload = await parseJsonResponse(res);
  return unwrapGalleryPayload(payload);
}

export async function reorderPosProductImages(
  productId: string | number,
  imageIds: number[]
): Promise<PosProductGalleryResult> {
  const res = await fetch(`/api/pos/products/${productId}/images/reorder`, {
    method: 'PUT',
    headers: gymAuthHeaders(true),
    body: JSON.stringify({ imageIds }),
  });
  const payload = await parseJsonResponse(res);
  return unwrapGalleryPayload(payload);
}

export async function deletePosProductGalleryImage(
  productId: string | number,
  imageId: number
): Promise<PosProductGalleryResult> {
  const res = await fetch(`/api/pos/products/${productId}/images/${imageId}`, {
    method: 'DELETE',
    headers: gymAuthHeaders(true),
  });
  const payload = await parseJsonResponse(res);
  return unwrapGalleryPayload(payload);
}

/** Legacy: remove featured only. Prefer deletePosProductGalleryImage. */
export async function deletePosProductImage(productId: string | number): Promise<void> {
  const res = await fetch(`/api/pos/products/${productId}/image`, {
    method: 'DELETE',
    headers: gymAuthHeaders(true),
  });
  await parseJsonResponse(res);
}

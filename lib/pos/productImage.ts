import { getErrorMessage } from '@/lib/errorHandler';
import { resolveMediaUrl } from '@/lib/resolveMediaUrl';

export { resolveMediaUrl as resolveProductImageUrl };

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
  return null;
}

export type PosProductImageUploadResult = {
  imageUrl: string | null;
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

export function posProductImageErrorMessage(error: unknown): string {
  const raw =
    (error as { message?: string })?.message ||
    (error instanceof Error ? error.message : '') ||
    getErrorMessage(error);
  const msg = String(raw || '');
  if (/too large|file size|max.*size|8\s*mb|payload/i.test(msg)) {
    return 'That image is too large. Use a photo under 8 MB.';
  }
  if (/invalid.*(type|image|format)|mime|jpeg|png|webp/i.test(msg)) {
    return 'Please choose a JPEG, PNG, or WebP image.';
  }
  return msg || 'Could not upload product image. Please try again.';
}

/** POST multipart image for an existing POS product. */
export async function uploadPosProductImage(
  productId: string | number,
  blob: Blob,
  filename = 'product.jpg'
): Promise<PosProductImageUploadResult> {
  const formData = new FormData();
  formData.append('image', blob, filename);

  const res = await fetch(`/api/pos/products/${productId}/image`, {
    method: 'POST',
    headers: gymAuthHeaders(false),
    body: formData,
  });

  const payload = await parseJsonResponse(res);
  const data = (payload.data ?? payload) as Record<string, unknown>;
  return { imageUrl: pickProductImageUrl(data) };
}

export async function deletePosProductImage(productId: string | number): Promise<void> {
  const res = await fetch(`/api/pos/products/${productId}/image`, {
    method: 'DELETE',
    headers: gymAuthHeaders(true),
  });
  await parseJsonResponse(res);
}

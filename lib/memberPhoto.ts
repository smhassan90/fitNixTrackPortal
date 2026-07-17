import { getErrorMessage } from '@/lib/errorHandler';
import { resolveMediaUrl } from '@/lib/resolveMediaUrl';

export { resolveMediaUrl as resolveMemberPhotoUrl };

/** Pull photoUrl from a member-like API object (top-level or nested `photo.url`). */
export function pickMemberPhotoUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.photoUrl === 'string' && data.photoUrl.trim()) return data.photoUrl.trim();
  const photo = data.photo;
  if (photo && typeof photo === 'object') {
    const url = (photo as { url?: unknown }).url;
    if (typeof url === 'string' && url.trim()) return url.trim();
  }
  return null;
}

export type MemberPhotoUploadResult = {
  photoUrl: string | null;
  photo?: {
    url?: string;
    sizeBytes?: number;
    width?: number;
    height?: number;
    mimeType?: string;
  } | null;
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

function pickPhotoUrl(data: Record<string, unknown> | null | undefined): string | null {
  if (!data) return null;
  if (typeof data.photoUrl === 'string' && data.photoUrl) return data.photoUrl;
  const photo = data.photo;
  if (photo && typeof photo === 'object' && typeof (photo as { url?: unknown }).url === 'string') {
    return (photo as { url: string }).url;
  }
  return null;
}

/** Map backend photo errors to staff-friendly copy. */
export function memberPhotoErrorMessage(error: unknown): string {
  const raw =
    (error as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response
      ?.data?.error?.message ||
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
    (error as { message?: string })?.message ||
    (error instanceof Error ? error.message : '') ||
    getErrorMessage(error);

  const msg = String(raw || '');

  if (/migration|photo_url|column.*photo|does not exist/i.test(msg)) {
    return 'Member photos are not enabled on the server yet. Ask an admin to run the latest database migration.';
  }
  if (/too large|file size|max.*size|8\s*mb|payload/i.test(msg)) {
    return 'That image is too large. Use a smaller photo (under 8 MB) or crop closer to the face.';
  }
  if (/invalid.*(type|image|format)|mime|jpeg|png|webp/i.test(msg)) {
    return 'Please choose a JPEG, PNG, or WebP image.';
  }
  if (/compress|quality|crop closer|face/i.test(msg)) {
    return 'Could not compress this photo. Crop closer to the face and try again.';
  }
  return msg || 'Could not update member photo. Please try again.';
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

export async function uploadMemberPhoto(
  memberId: string | number,
  blob: Blob,
  filename = 'photo.jpg'
): Promise<MemberPhotoUploadResult> {
  const formData = new FormData();
  formData.append('photo', blob, filename);

  // Use fetch so the browser sets multipart boundary (axios default JSON Content-Type breaks uploads).
  const res = await fetch(`/api/members/${memberId}/photo`, {
    method: 'POST',
    headers: gymAuthHeaders(false),
    body: formData,
  });

  const payload = await parseJsonResponse(res);
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const photoUrl = pickPhotoUrl(data);
  return {
    photoUrl,
    photo:
      data.photo && typeof data.photo === 'object'
        ? (data.photo as MemberPhotoUploadResult['photo'])
        : null,
  };
}

export async function deleteMemberPhoto(memberId: string | number): Promise<void> {
  const res = await fetch(`/api/members/${memberId}/photo`, {
    method: 'DELETE',
    headers: gymAuthHeaders(true),
  });
  await parseJsonResponse(res);
}

/** Initials for avatar placeholder (up to 2 letters). */
export function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

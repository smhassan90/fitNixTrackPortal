import { readPlatformToken } from '@/lib/platform/platformClient';
import { PlatformApiError } from '@/lib/platform/errors';

export async function uploadPlatformGymLogo(file: File): Promise<string> {
  const token = readPlatformToken();
  if (!token) {
    throw new PlatformApiError(401, 'UNAUTHORIZED', 'Platform session required');
  }
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/platform/upload-logo', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = (await res.json()) as {
    success: boolean;
    data?: { url: string };
    error?: { code?: string; message?: string };
  };
  if (!body.success || !body.data?.url) {
    throw new PlatformApiError(
      res.status,
      body.error?.code,
      body.error?.message || 'Upload failed'
    );
  }
  return body.data.url;
}

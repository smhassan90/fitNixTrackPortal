import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function extForMime(mime: string): string | null {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return null;
}

/**
 * Stores logo under /public/gym-logos and returns an absolute http(s) URL for logoUrl.
 * Requires a valid platform JWT (validated against the same API as the rest of the app).
 *
 * For production, prefer object storage (S3, etc.); serverless hosts often have a read-only
 * filesystem — set NEXT_PUBLIC_APP_URL to a stable public origin the API can reach.
 */
export async function POST(request: NextRequest) {
  try {
    const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
    const auth = request.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization' } },
        { status: 401 }
      );
    }

    const me = await fetch(`${apiUrl}/api/platform/auth/me`, {
      headers: { Authorization: auth },
    });
    if (!me.ok) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired platform session' } },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const entry = formData.get('file');
    if (!entry || typeof entry === 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Expected multipart field "file"' } },
        { status: 400 }
      );
    }

    const file = entry as File;
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Image must be 2 MB or smaller' } },
        { status: 400 }
      );
    }

    const mime = file.type;
    if (!ALLOWED.has(mime)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Only PNG, JPEG, WebP, or GIF images are allowed',
          },
        },
        { status: 400 }
      );
    }

    const ext = extForMime(mime);
    if (!ext) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Unsupported image type' } },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `${randomUUID()}.${ext}`;
    const dir = path.join(process.cwd(), 'public', 'gym-logos');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), buffer);

    const publicBase =
      (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, '') ||
      request.nextUrl.origin;
    const url = `${publicBase}/gym-logos/${filename}`;

    return NextResponse.json({ success: true, data: { url } });
  } catch (e) {
    console.error('upload-logo:', e);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to store image' } },
      { status: 500 }
    );
  }
}

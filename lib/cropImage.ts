import type { Area } from 'react-easy-crop';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', () => reject(new Error('Failed to load image for crop')));
    img.setAttribute('crossOrigin', 'anonymous');
    img.src = src;
  });
}

function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = (rotation * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

export type CropExportOptions = {
  maxSize?: number;
  quality?: number;
  /** jpeg for photos; png keeps transparency for logos */
  mimeType?: 'image/jpeg' | 'image/png';
};

/**
 * Crop + optionally rotate an image, then export a square blob.
 * Target size ~480–720px so upload stays fast.
 */
export async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0,
  options?: CropExportOptions
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const maxSize = options?.maxSize ?? 640;
  const quality = options?.quality ?? 0.8;
  const mimeType = options?.mimeType ?? 'image/jpeg';

  const rotRad = (rotation * Math.PI) / 180;
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rotation);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bBoxWidth));
  canvas.height = Math.max(1, Math.round(bBoxHeight));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare image crop');

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);

  const cropW = Math.max(1, Math.round(pixelCrop.width));
  const cropH = Math.max(1, Math.round(pixelCrop.height));
  const outSize = Math.min(maxSize, Math.max(cropW, cropH));

  const out = document.createElement('canvas');
  out.width = outSize;
  out.height = outSize;
  const outCtx = out.getContext('2d');
  if (!outCtx) throw new Error('Could not prepare image crop');

  if (mimeType === 'image/jpeg') {
    outCtx.fillStyle = '#ffffff';
    outCtx.fillRect(0, 0, outSize, outSize);
  }

  outCtx.drawImage(
    canvas,
    Math.round(pixelCrop.x),
    Math.round(pixelCrop.y),
    cropW,
    cropH,
    0,
    0,
    outSize,
    outSize
  );

  return new Promise((resolve, reject) => {
    out.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not export cropped image. Adjust the crop and try again.'));
          return;
        }
        resolve(blob);
      },
      mimeType,
      mimeType === 'image/jpeg' ? quality : undefined
    );
  });
}

/** @deprecated Prefer getCroppedImageBlob — kept for existing member photo call sites. */
export async function getCroppedJpegBlob(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0,
  options?: { maxSize?: number; quality?: number }
): Promise<Blob> {
  return getCroppedImageBlob(imageSrc, pixelCrop, rotation, {
    ...options,
    mimeType: 'image/jpeg',
  });
}

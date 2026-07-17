'use client';

import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { getCroppedJpegBlob } from '@/lib/cropImage';

type Props = {
  imageSrc: string;
  open: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
  busy?: boolean;
  /** Upload/API error from parent — shown inside the dialog so it is never hidden behind it. */
  submitError?: string | null;
};

export default function MemberPhotoCropModal({
  imageSrc,
  open,
  onCancel,
  onConfirm,
  busy = false,
  submitError = null,
}: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
    setPreviewUrl(null);
  }, []);

  const buildPreview = useCallback(async () => {
    if (!croppedAreaPixels) return;
    try {
      setError(null);
      const blob = await getCroppedJpegBlob(imageSrc, croppedAreaPixels, rotation, {
        maxSize: 240,
        quality: 0.75,
      });
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch {
      setError('Could not build preview. Adjust the crop and try again.');
    }
  }, [croppedAreaPixels, imageSrc, rotation]);

  const handleUsePhoto = async () => {
    if (!croppedAreaPixels || busy || exporting) return;
    try {
      setExporting(true);
      setError(null);
      const blob = await getCroppedJpegBlob(imageSrc, croppedAreaPixels, rotation, {
        maxSize: 640,
        quality: 0.82,
      });
      onConfirm(blob);
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'Crop closer to the face and try again.'
      );
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  const disabled = busy || exporting;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close crop dialog"
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!disabled) onCancel();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-photo-crop-title"
        className="relative z-10 flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
      >
        <div className="border-b border-gray-100 px-5 py-4">
          <h3 id="member-photo-crop-title" className="text-lg font-semibold text-dark-gray">
            Adjust photo
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Drag and pinch to frame the face in the square. Then use the photo.
          </p>
        </div>

        <div className="relative h-72 w-full bg-gray-900 sm:h-80">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            minZoom={1}
            maxZoom={4}
          />
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="member-photo-zoom" className="block text-sm font-medium text-dark-gray">
              Zoom
            </label>
            <input
              id="member-photo-zoom"
              type="range"
              min={1}
              max={4}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              disabled={disabled}
              className="mt-2 w-full accent-primary"
              aria-valuemin={1}
              aria-valuemax={4}
              aria-valuenow={zoom}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              disabled={disabled}
              className="rounded-lg bg-gray-200 px-3 py-2 text-sm font-medium text-dark-gray hover:bg-gray-300 disabled:opacity-50"
            >
              Rotate 90°
            </button>
            <button
              type="button"
              onClick={() => void buildPreview()}
              disabled={disabled || !croppedAreaPixels}
              className="rounded-lg bg-gray-200 px-3 py-2 text-sm font-medium text-dark-gray hover:bg-gray-300 disabled:opacity-50"
            >
              Preview crop
            </button>
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Cropped preview"
                className="h-12 w-12 rounded-full border border-gray-200 object-cover"
              />
            )}
          </div>

          {(error || submitError) && (
            <p className="text-sm text-red-600" role="alert">
              {error || submitError}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-dark-gray hover:bg-gray-300 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleUsePhoto()}
            disabled={disabled || !croppedAreaPixels}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
          >
            {busy || exporting ? 'Saving…' : 'Use photo'}
          </button>
        </div>
      </div>
    </div>
  );
}

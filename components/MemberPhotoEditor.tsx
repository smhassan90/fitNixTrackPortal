'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import MemberPhotoCropModal from '@/components/MemberPhotoCropModal';
import {
  deleteMemberPhoto,
  memberInitials,
  memberPhotoErrorMessage,
  resolveMemberPhotoUrl,
  uploadMemberPhoto,
} from '@/lib/memberPhoto';

const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_PICK_BYTES = 8 * 1024 * 1024;

type Props = {
  memberId: string | number;
  memberName: string;
  photoUrl: string | null;
  disabled?: boolean;
  onPhotoChange: (photoUrl: string | null) => void;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
};

function prefersCameraAndGallery(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.matchMedia('(max-width: 1024px)').matches;
  return coarse || narrow;
}

export default function MemberPhotoEditor({
  memberId,
  memberName,
  photoUrl,
  disabled = false,
  onPhotoChange,
  onError,
  onSuccess,
}: Props) {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [localUrl, setLocalUrl] = useState(photoUrl);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [mobileSources, setMobileSources] = useState(false);

  useEffect(() => {
    setLocalUrl(photoUrl);
  }, [photoUrl]);

  useEffect(() => {
    setMobileSources(prefersCameraAndGallery());
  }, []);

  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  const displayUrl = useMemo(() => resolveMemberPhotoUrl(localUrl), [localUrl]);
  const initials = memberInitials(memberName);
  const hasPhoto = Boolean(displayUrl);
  const busy = disabled || uploading;

  const openPicker = (mode: 'gallery' | 'camera') => {
    if (busy) return;
    if (mode === 'camera') cameraInputRef.current?.click();
    else galleryInputRef.current?.click();
  };

  const onFileChosen = (file: File | undefined) => {
    if (!file || busy) return;
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const okExt = /\.(jpe?g|png|webp)$/i.test(file.name);
    if (file.type && !allowed.has(file.type) && !okExt) {
      onError?.('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (!file.type && !okExt) {
      onError?.('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_PICK_BYTES) {
      onError?.('That image is too large. Use a photo under 8 MB.');
      return;
    }
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(URL.createObjectURL(file));
  };

  const closeCrop = () => {
    if (uploading) return;
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const handleCropConfirm = async (blob: Blob) => {
    try {
      setUploading(true);
      const result = await uploadMemberPhoto(memberId, blob, 'photo.jpg');
      const next = result.photoUrl;
      setLocalUrl(next);
      onPhotoChange(next);
      if (cropSrc) URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
      onSuccess?.('Member photo updated.');
    } catch (e) {
      onError?.(memberPhotoErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    try {
      setUploading(true);
      await deleteMemberPhoto(memberId);
      setLocalUrl(null);
      onPhotoChange(null);
      onSuccess?.('Member photo removed.');
    } catch (e) {
      onError?.(memberPhotoErrorMessage(e));
    } finally {
      setUploading(false);
      setRemoveOpen(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
      <p className="mb-3 text-sm font-medium text-dark-gray">Member photo</p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-primary/10 text-xl font-semibold text-primary shadow-sm"
          aria-hidden={hasPhoto}
        >
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span aria-label={`Initials ${initials}`}>{initials}</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs text-gray-500">
            Square face crop is required before upload. Photos are compressed on the server.
          </p>

          <div className="flex flex-wrap gap-2">
            {mobileSources ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => openPicker('camera')}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
                  aria-label={hasPhoto ? 'Take a new photo with camera' : 'Take a photo with camera'}
                >
                  Camera
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => openPicker('gallery')}
                  className="rounded-lg bg-gray-200 px-3 py-2 text-sm font-medium text-dark-gray hover:bg-gray-300 disabled:opacity-50"
                  aria-label={hasPhoto ? 'Choose a new photo from gallery' : 'Choose a photo from gallery'}
                >
                  Gallery
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => openPicker('gallery')}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
                aria-label={hasPhoto ? 'Change member photo' : 'Add member photo'}
              >
                {hasPhoto ? 'Change photo' : 'Add photo'}
              </button>
            )}

            {hasPhoto && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setRemoveOpen(true)}
                className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                aria-label="Remove member photo"
              >
                Remove photo
              </button>
            )}
          </div>

          {uploading && <p className="text-xs text-primary">Uploading…</p>}
        </div>
      </div>

      {/* Hidden file inputs: gallery + optional camera capture */}
      <input
        ref={galleryInputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          onFileChosen(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept={ACCEPT}
        capture="user"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          onFileChosen(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {cropSrc && (
        <MemberPhotoCropModal
          open
          imageSrc={cropSrc}
          busy={uploading}
          onCancel={closeCrop}
          onConfirm={(blob) => void handleCropConfirm(blob)}
        />
      )}

      <ConfirmationDialog
        isOpen={removeOpen}
        onClose={() => {
          if (!uploading) setRemoveOpen(false);
        }}
        onConfirm={() => {
          void handleRemove();
        }}
        title="Remove photo"
        message="Remove this member’s portrait? You can add a new one later."
        confirmText="Remove"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}

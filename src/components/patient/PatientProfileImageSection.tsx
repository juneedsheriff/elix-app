import { useEffect, useId, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Trash2, User } from 'lucide-react';
import { useSupabase } from '../../context/SupabaseProvider';
import { isAcceptedProfileImageFile, resizeImageFileToSquareDataUrl } from '../../lib/imageFiles';
import { updatePatientAvatarForUser } from '../../lib/patients';
import PatientCameraCaptureModal from './PatientCameraCaptureModal';

type PatientProfileImageSectionProps = {
  userId: string;
  avatarUrl: string | null;
  displayName?: string;
  disabled?: boolean;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export default function PatientProfileImageSection({
  userId,
  avatarUrl,
  displayName = '',
  disabled = false
}: PatientProfileImageSectionProps) {
  const { refreshPatientProfile } = useSupabase();
  const inputId = useId();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(avatarUrl);
  const [previewBroken, setPreviewBroken] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    setPreviewUrl(avatarUrl);
    setPreviewBroken(false);
  }, [avatarUrl]);

  const trimmed = (previewUrl ?? '').trim();
  const showPreview = Boolean(trimmed) && !previewBroken;
  const initials = initialsFromName(displayName);

  const saveAvatar = async (nextUrl: string | null) => {
    setBusy(true);
    setFileError(null);
    setSuccess(null);

    const { data, error } = await updatePatientAvatarForUser(userId, nextUrl);
    setBusy(false);

    if (error) {
      setPreviewUrl(avatarUrl);
      setFileError(error.message);
      return;
    }

    await refreshPatientProfile();
    const saved = data?.avatar_url ?? null;
    setPreviewUrl(saved);
    setPreviewBroken(false);
    setSuccess(nextUrl ? 'Profile photo updated.' : 'Profile photo removed.');
  };

  const processAndSaveDataUrl = async (dataUrl: string) => {
    if (busy) return;

    setBusy(true);
    setFileError(null);
    setSuccess(null);
    setPreviewUrl(dataUrl);

    const { data, error } = await updatePatientAvatarForUser(userId, dataUrl);
    if (error) {
      setPreviewUrl(avatarUrl);
      setFileError(error.message);
      setBusy(false);
      return;
    }

    await refreshPatientProfile();
    const saved = data?.avatar_url ?? null;
    setPreviewUrl(saved);
    setPreviewBroken(false);
    setSuccess('Profile photo updated.');
    setBusy(false);
  };

  const processAndSaveFile = async (file: File | null) => {
    if (!file || busy) return;

    setBusy(true);
    setFileError(null);
    setSuccess(null);

    if (!isAcceptedProfileImageFile(file)) {
      setFileError('Choose a JPEG, PNG, WebP, or GIF image.');
      setBusy(false);
      return;
    }

    try {
      const dataUrl = await resizeImageFileToSquareDataUrl(file);
      await processAndSaveDataUrl(dataUrl);
    } catch {
      setPreviewUrl(avatarUrl);
      setFileError('Could not process the selected image.');
      setBusy(false);
    }
  };

  const handleFileInputChange = (file: File | null, input: HTMLInputElement | null) => {
    void processAndSaveFile(file);
    if (input) input.value = '';
  };

  const handleCameraCapture = (dataUrl: string) => {
    setCameraOpen(false);
    void processAndSaveDataUrl(dataUrl);
  };

  return (
    <section className='patient-profile-image' aria-labelledby={`${inputId}-heading`}>
      <h3 id={`${inputId}-heading`} className='patient-profile-edit__section-title patient-profile-image__title'>
        Profile photo
        <span className='patient-profile-image__optional'>(optional)</span>
      </h3>

      <div className='patient-profile-image__layout'>
        <div className='patient-profile-image__preview-wrap'>
          {showPreview ? (
            <img
              src={trimmed}
              alt='Your profile photo'
              className='patient-profile-image__preview'
              onError={() => setPreviewBroken(true)}
              onLoad={() => setPreviewBroken(false)}
            />
          ) : (
            <div className='patient-profile-image__placeholder' aria-hidden>
              {initials ? (
                <span className='patient-profile-image__initials'>{initials}</span>
              ) : (
                <User size={36} strokeWidth={1.5} />
              )}
            </div>
          )}
        </div>

        <div className='patient-profile-image__controls'>
          <p className='muted patient-profile-image__hint'>
            Add a photo so doctors can recognize you. Large images are automatically resized to 512×512.
          </p>

          {previewBroken && trimmed ? (
            <p className='auth-error patient-profile-image__hint' role='alert'>
              This image could not be loaded. Upload a new one.
            </p>
          ) : null}

          {fileError ? (
            <p className='auth-error patient-profile-image__hint' role='alert'>
              {fileError}
            </p>
          ) : null}

          {success ? (
            <p className='patient-profile-edit__success patient-profile-image__hint' role='status'>
              {success}
            </p>
          ) : null}

          <div className='patient-profile-image__actions'>
            <input
              ref={galleryInputRef}
              type='file'
              accept='image/jpeg,image/png,image/webp,image/gif'
              className='patient-profile-image__file-input'
              disabled={disabled || busy}
              onChange={(e) => handleFileInputChange(e.target.files?.[0] ?? null, e.target)}
            />
            <button
              type='button'
              className='secondary-btn'
              disabled={disabled || busy}
              onClick={() => galleryInputRef.current?.click()}
            >
              {busy ? (
                <>
                  <Loader2 size={16} className='spin' aria-hidden /> Saving…
                </>
              ) : (
                <>
                  <ImagePlus size={16} aria-hidden />
                  {trimmed ? 'Change photo' : 'Upload photo'}
                </>
              )}
            </button>
            <button
              type='button'
              className='secondary-btn'
              disabled={disabled || busy}
              onClick={() => setCameraOpen(true)}
            >
              {busy ? (
                <>
                  <Loader2 size={16} className='spin' aria-hidden /> Saving…
                </>
              ) : (
                <>
                  <Camera size={16} aria-hidden />
                  Take photo
                </>
              )}
            </button>
            {trimmed ? (
              <button
                type='button'
                className='text-btn patient-profile-image__remove'
                disabled={disabled || busy}
                onClick={() => void saveAvatar(null)}
              >
                <Trash2 size={14} aria-hidden />
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <PatientCameraCaptureModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </section>
  );
}

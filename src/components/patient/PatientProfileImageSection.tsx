import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, User } from 'lucide-react';
import { useSupabase } from '../../context/SupabaseProvider';
import { updatePatientAvatarForUser } from '../../lib/patients';

const MAX_UPLOAD_BYTES = 512 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(avatarUrl);
  const [previewBroken, setPreviewBroken] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

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

  const handleFileChange = (file: File | null) => {
    if (!file || busy) return;
    setFileError(null);
    setSuccess(null);

    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      setFileError('Choose a JPEG, PNG, WebP, or GIF image.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setFileError('Image must be 512 KB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;
      setPreviewUrl(result);
      void saveAvatar(result);
    };
    reader.onerror = () => {
      setFileError('Could not read the selected image.');
    };
    reader.readAsDataURL(file);
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
            Add a photo so doctors can recognize you. JPEG, PNG, WebP, or GIF up to 512 KB.
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
              ref={fileInputRef}
              type='file'
              accept='image/jpeg,image/png,image/webp,image/gif'
              className='patient-profile-image__file-input'
              disabled={disabled || busy}
              onChange={(e) => {
                handleFileChange(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
            <button
              type='button'
              className='secondary-btn'
              disabled={disabled || busy}
              onClick={() => fileInputRef.current?.click()}
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
    </section>
  );
}

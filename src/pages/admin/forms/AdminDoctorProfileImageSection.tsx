import { useId, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, User } from 'lucide-react';
import { DEFAULT_DOCTOR_IMAGE_PLACEHOLDER } from '../../../lib/doctorProfile';
import { isAcceptedProfileImageFile, resizeImageFileToSquareDataUrl } from '../../../lib/imageFiles';

type AdminDoctorProfileImageSectionProps = {
  imageUrl: string;
  onChange: (url: string) => void;
  displayName?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export default function AdminDoctorProfileImageSection({
  imageUrl,
  onChange,
  displayName = '',
  disabled = false,
  readOnly = false,
  required = false
}: AdminDoctorProfileImageSectionProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewBroken, setPreviewBroken] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const initials = initialsFromName(displayName);
  const trimmed = imageUrl.trim();
  const showPreview = Boolean(trimmed) && !previewBroken;
  const controlsDisabled = disabled || processing;

  const handleFileChange = async (file: File | null) => {
    if (!file || processing) return;
    setFileError(null);

    if (!isAcceptedProfileImageFile(file)) {
      setFileError('Choose a JPEG, PNG, WebP, or GIF image.');
      return;
    }

    setProcessing(true);
    try {
      const dataUrl = await resizeImageFileToSquareDataUrl(file);
      setPreviewBroken(false);
      onChange(dataUrl);
    } catch {
      setFileError('Could not process the selected image. Try another file.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section className='admin-doctor-profile-image' aria-labelledby={`${inputId}-heading`}>
      <h3 id={`${inputId}-heading`} className='elixhealth-form-section-title'>
        Profile photo
        {required ? (
          <span className='elixhealth-required' aria-hidden='true'>
            {' '}
            *
          </span>
        ) : null}
      </h3>

      <div className='admin-doctor-profile-image__layout'>
        <div className='admin-doctor-profile-image__preview-wrap'>
          {showPreview ? (
            <img
              src={trimmed}
              alt='Doctor profile preview'
              className='admin-doctor-profile-image__preview'
              onError={() => setPreviewBroken(true)}
              onLoad={() => setPreviewBroken(false)}
            />
          ) : (
            <div className='admin-doctor-profile-image__placeholder' aria-hidden>
              {initials ? (
                <span className='admin-doctor-profile-image__initials'>{initials}</span>
              ) : (
                <User size={40} strokeWidth={1.5} />
              )}
            </div>
          )}
        </div>

        <div className='admin-doctor-profile-image__controls'>
          {previewBroken && trimmed ? (
            <p className='auth-error admin-doctor-profile-image__hint' role='alert'>
              This image URL could not be loaded. Check the link or upload a new image.
            </p>
          ) : (
            <p className='muted admin-doctor-profile-image__hint'>
              Large images are automatically resized to 512×512 and compressed.
            </p>
          )}

          {fileError ? (
            <p className='auth-error admin-doctor-profile-image__hint' role='alert'>
              {fileError}
            </p>
          ) : null}

          {!readOnly ? (
            <div className='admin-doctor-profile-image__actions'>
              <input
                ref={fileInputRef}
                type='file'
                accept='image/jpeg,image/png,image/webp,image/gif'
                className='admin-doctor-profile-image__file-input'
                disabled={controlsDisabled}
                onChange={(e) => {
                  void handleFileChange(e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
              />
              <button
                type='button'
                className='secondary-btn'
                disabled={controlsDisabled}
                onClick={() => fileInputRef.current?.click()}
              >
                {processing ? (
                  <>
                    <Loader2 size={16} className='spin' aria-hidden />
                    Processing…
                  </>
                ) : (
                  <>
                    <ImagePlus size={16} aria-hidden />
                    Upload image
                  </>
                )}
              </button>
              <button
                type='button'
                className='text-btn admin-doctor-profile-image__remove'
                disabled={controlsDisabled || !trimmed}
                onClick={() => {
                  setPreviewBroken(false);
                  setFileError(null);
                  onChange(DEFAULT_DOCTOR_IMAGE_PLACEHOLDER);
                }}
              >
                <Trash2 size={14} aria-hidden />
                Remove
              </button>
            </div>
          ) : trimmed ? (
            <p className='muted admin-doctor-profile-image__readonly-url'>
              <span className='admin-doctor-profile-image__readonly-label'>Image URL</span>
              {trimmed.startsWith('data:') ? 'Embedded image' : trimmed}
            </p>
          ) : (
            <p className='muted'>No profile photo set.</p>
          )}
        </div>
      </div>
    </section>
  );
}

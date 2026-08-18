import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Camera, FileUp, Loader2, Trash2 } from 'lucide-react';
import ImageLightboxGallery, { type LightboxImageItem } from '../common/ImageLightboxGallery';
import PatientCameraCaptureModal from './PatientCameraCaptureModal';
import { isImageFileName, isImageMimeType, dataUrlToFile } from '../../lib/imageFiles';
import { getMedicalRecordDownloadUrl, openMedicalRecordByPath } from '../../lib/records';
import { uploadPatientAttachedDocument } from '../../lib/patients';
import type { PatientAttachedDocument } from '../../types/patient';

type PatientDocumentListProps = {
  label: string;
  documents: PatientAttachedDocument[];
  onChange: (next: PatientAttachedDocument[]) => void;
  disabled?: boolean;
  allowCamera?: boolean;
  hint?: string;
  /** Limits upload/validation for this specific document list. */
  uploadKind?: 'govt_id' | 'default';
};

function isPatientAttachedDocumentImage(doc: PatientAttachedDocument): boolean {
  return isImageMimeType(doc.mime_type) || isImageFileName(doc.file_name);
}

export default function PatientDocumentList({
  label,
  documents,
  onChange,
  disabled = false,
  allowCamera = true,
  hint,
  uploadKind = 'default'
}: PatientDocumentListProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<LightboxImageItem[]>([]);
  const [lightboxLoading, setLightboxLoading] = useState(false);
  const [lightboxError, setLightboxError] = useState<string | null>(null);

  const imageDocuments = useMemo(
    () => documents.filter((doc) => isPatientAttachedDocumentImage(doc)),
    [documents]
  );
  const otherDocuments = useMemo(
    () => documents.filter((doc) => !isPatientAttachedDocumentImage(doc)),
    [documents]
  );

  useEffect(() => {
    const urlsToRevoke: string[] = [];
    let cancelled = false;

    async function loadPreviews() {
      if (imageDocuments.length === 0) {
        setLightboxImages([]);
        setLightboxError(null);
        setLightboxLoading(false);
        return;
      }

      setLightboxLoading(true);
      setLightboxError(null);

      const results = await Promise.all(
        imageDocuments.map(async (doc) => {
          const { data, error: urlError } = await getMedicalRecordDownloadUrl(doc.storage_path);
          if (urlError || !data?.signedUrl) {
            return {
              doc,
              url: null as string | null,
              error: urlError?.message ?? 'Could not load image preview.'
            };
          }
          urlsToRevoke.push(data.signedUrl);
          return { doc, url: data.signedUrl, error: null };
        })
      );

      if (cancelled) {
        urlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      const failed = results.find((result) => !result.url);
      if (failed) {
        setLightboxError(failed.error ?? 'Could not load one or more image previews.');
      }

      setLightboxImages(
        results
          .filter((result): result is typeof result & { url: string } => Boolean(result.url))
          .map((result) => ({
            id: result.doc.id,
            src: result.url,
            alt: result.doc.file_name,
            caption: result.doc.file_name
          }))
      );
      setLightboxLoading(false);
    }

    void loadPreviews();
    return () => {
      cancelled = true;
      urlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageDocuments]);

  const addFile = async (file: File | null) => {
    if (!file || disabled || busy) return;
    setBusy(true);
    setError(null);
    const { data, error: uploadError } = await uploadPatientAttachedDocument(file, {
      kind: uploadKind
    });
    setBusy(false);
    if (uploadError || !data) {
      setError(uploadError?.message ?? 'Could not upload the document.');
      return;
    }
    onChange([...documents, data]);
  };

  const removeDoc = (id: string) => {
    if (disabled || busy) return;
    onChange(documents.filter((doc) => doc.id !== id));
  };

  const openDoc = async (doc: PatientAttachedDocument) => {
    const { error: openError } = await openMedicalRecordByPath(doc.storage_path, {
      fileName: doc.file_name
    });
    if (openError) setError(openError.message);
  };

  return (
    <div className='patient-document-list'>
      <div className='patient-document-list__head'>
        <span className='patient-document-list__label'>{label}</span>
        {hint ? <span className='patient-document-list__hint muted'>{hint}</span> : null}
      </div>

      {imageDocuments.length > 0 ? (
        <div className='patient-document-list__previews'>
          <p className='patient-document-list__preview-hint muted'>Click an image to view full size.</p>
          <ImageLightboxGallery
            images={lightboxImages}
            loading={lightboxLoading}
            error={lightboxError}
            className='patient-document-list__lightbox'
          />
          <ul className='patient-document-list__items patient-document-list__items--images'>
            {imageDocuments.map((doc) => (
              <li key={doc.id} className='patient-document-list__item'>
                <span className='patient-document-list__file-name'>{doc.file_name}</span>
                <button
                  type='button'
                  className='secondary-btn patient-document-list__remove'
                  disabled={disabled || busy}
                  onClick={() => removeDoc(doc.id)}
                  aria-label={`Remove ${doc.file_name}`}
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {otherDocuments.length > 0 ? (
        <ul className='patient-document-list__items'>
          {otherDocuments.map((doc) => (
            <li key={doc.id} className='patient-document-list__item'>
              <button
                type='button'
                className='patient-document-list__name'
                onClick={() => void openDoc(doc)}
              >
                {doc.file_name}
              </button>
              <button
                type='button'
                className='secondary-btn patient-document-list__remove'
                disabled={disabled || busy}
                onClick={() => removeDoc(doc.id)}
                aria-label={`Remove ${doc.file_name}`}
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {documents.length === 0 ? (
        <p className='muted patient-document-list__empty'>No documents uploaded yet.</p>
      ) : null}

      <div className='patient-document-list__actions'>
        <input
          id={inputId}
          ref={fileInputRef}
          type='file'
          accept={
            uploadKind === 'govt_id'
              ? 'image/*'
              : '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,image/*'
          }
          className='patient-document-list__file-input'
          disabled={disabled || busy}
          onChange={(event) => {
            void addFile(event.target.files?.[0] ?? null);
            event.target.value = '';
          }}
        />
        <button
          type='button'
          className='secondary-btn'
          disabled={disabled || busy}
          onClick={() => fileInputRef.current?.click()}
        >
          {busy ? <Loader2 size={16} className='spin' aria-hidden /> : <FileUp size={16} aria-hidden />}
          Upload
        </button>
        {allowCamera ? (
          <button
            type='button'
            className='secondary-btn'
            disabled={disabled || busy}
            onClick={() => setCameraOpen(true)}
          >
            <Camera size={16} aria-hidden />
            Take photo
          </button>
        ) : null}
      </div>

      {error ? (
        <p className='auth-error' role='alert'>
          {error}
        </p>
      ) : null}

      <PatientCameraCaptureModal
        open={cameraOpen}
        mode='document'
        onClose={() => setCameraOpen(false)}
        onCapture={(dataUrl) => {
          setCameraOpen(false);
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          void addFile(dataUrlToFile(dataUrl, `document-${timestamp}.jpg`));
        }}
      />
    </div>
  );
}

import { useId, useRef, useState } from 'react';
import { Camera, FileUp, Loader2, Trash2 } from 'lucide-react';
import PatientCameraCaptureModal from './PatientCameraCaptureModal';
import { dataUrlToFile } from '../../lib/imageFiles';
import { openMedicalRecordByPath } from '../../lib/records';
import { uploadPatientAttachedDocument } from '../../lib/patients';
import type { PatientAttachedDocument } from '../../types/patient';

type PatientDocumentListProps = {
  label: string;
  documents: PatientAttachedDocument[];
  onChange: (next: PatientAttachedDocument[]) => void;
  disabled?: boolean;
  allowCamera?: boolean;
  hint?: string;
};

export default function PatientDocumentList({
  label,
  documents,
  onChange,
  disabled = false,
  allowCamera = true,
  hint
}: PatientDocumentListProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const addFile = async (file: File | null) => {
    if (!file || disabled || busy) return;
    setBusy(true);
    setError(null);
    const { data, error: uploadError } = await uploadPatientAttachedDocument(file);
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
    const { error: openError } = await openMedicalRecordByPath(doc.storage_path);
    if (openError) setError(openError.message);
  };

  return (
    <div className='patient-document-list'>
      <div className='patient-document-list__head'>
        <span className='patient-document-list__label'>{label}</span>
        {hint ? <span className='patient-document-list__hint muted'>{hint}</span> : null}
      </div>

      {documents.length ? (
        <ul className='patient-document-list__items'>
          {documents.map((doc) => (
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
      ) : (
        <p className='muted patient-document-list__empty'>No documents uploaded yet.</p>
      )}

      <div className='patient-document-list__actions'>
        <input
          id={inputId}
          ref={fileInputRef}
          type='file'
          accept='.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,image/*'
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

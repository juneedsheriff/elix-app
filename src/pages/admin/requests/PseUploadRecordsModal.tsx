import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { CloudUpload, Loader2, X } from 'lucide-react';
import { Select } from '@mantine/core';
import {
  DEFAULT_MEDICAL_RECORD_CATEGORY,
  MEDICAL_RECORD_CATEGORIES,
  type MedicalRecordCategoryId
} from '../../../lib/medicalRecordCategories';
import { medicalFileValidationError } from '../../../lib/records';
import { pseUploadRecordToRequest } from '../../../lib/opinionRequests';
import { truncateFileName } from '../../../lib/truncateLabel';

const ACCEPT = '.pdf,.jpg,.jpeg,.doc,.docx';

const CATEGORY_OPTIONS = MEDICAL_RECORD_CATEGORIES.filter(
  (category) => category.id !== 'dicom_file'
).map((category) => ({
  value: category.id,
  label: category.label
}));

type PseUploadRecordsModalProps = {
  open: boolean;
  requestId: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onUploaded: () => void;
};

export default function PseUploadRecordsModal({
  open,
  requestId,
  onClose,
  onSuccess,
  onError,
  onUploaded
}: PseUploadRecordsModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<MedicalRecordCategoryId>(DEFAULT_MEDICAL_RECORD_CATEGORY);
  const [uploading, setUploading] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCategory(DEFAULT_MEDICAL_RECORD_CATEGORY);
    setProgressLabel(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !uploading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, uploading]);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!selected.length) return;

    const files: File[] = [];
    for (const file of selected) {
      const validationError = medicalFileValidationError(file);
      if (validationError) {
        onError(validationError);
        return;
      }
      files.push(file);
    }

    setUploading(true);
    let uploadedCount = 0;
    const failures: string[] = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setProgressLabel(`Uploading ${index + 1} of ${files.length}…`);
      const { data, error } = await pseUploadRecordToRequest(requestId, file, { category });
      if (error || !data) {
        failures.push(`${truncateFileName(file.name)}: ${error?.message ?? 'Upload failed.'}`);
        continue;
      }
      uploadedCount += 1;
    }

    setUploading(false);
    setProgressLabel(null);

    if (uploadedCount > 0) {
      onUploaded();
      onSuccess(
        uploadedCount === 1
          ? `1 file uploaded for the patient and added to this request.`
          : `${uploadedCount} files uploaded for the patient and added to this request.`
      );
    }

    if (failures.length) {
      onError(failures.join(' '));
      return;
    }

    onClose();
  };

  if (!open) return null;

  return (
    <div className='elixhealth-modal-root patient-records-modal-root' role='presentation'>
      <button
        type='button'
        className='elixhealth-modal-backdrop'
        onClick={onClose}
        aria-label='Close upload records'
        disabled={uploading}
      />
      <div
        className='elixhealth-modal patient-records-modal patient-attach-records-modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='pse-upload-records-modal-title'
      >
        <div className='elixhealth-modal-head'>
          <div>
            <h2 id='pse-upload-records-modal-title'>Upload records for patient</h2>
            <p className='muted'>
              Files are saved to the patient&apos;s records vault and attached to this request. You
              can select multiple files.
            </p>
          </div>
          <button
            type='button'
            className='icon-btn elixhealth-modal-close'
            onClick={onClose}
            aria-label='Close'
            disabled={uploading}
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className='elixhealth-modal-body patient-attach-records-modal__body'>
          <section className='patient-attach-records-modal__section'>
            <Select
              label='Record category'
              data={CATEGORY_OPTIONS}
              value={category}
              onChange={(value) =>
                setCategory((value as MedicalRecordCategoryId) ?? DEFAULT_MEDICAL_RECORD_CATEGORY)
              }
              disabled={uploading}
              comboboxProps={{ withinPortal: true }}
            />
          </section>

          <section className='patient-attach-records-modal__section' aria-labelledby='pse-upload-heading'>
            <h3 id='pse-upload-heading' className='patient-attach-records-modal__heading'>
              Upload files
            </h3>
            <p className='muted patient-attach-records-modal__hint'>
              PDF, JPG, or DOC/DOCX up to 10 MB each. Select one or more files. The patient will see
              these on their dashboard.
            </p>
            <input
              ref={fileInputRef}
              type='file'
              accept={ACCEPT}
              multiple
              className='patient-attach-records-modal__file-input'
              onChange={(event) => void handleUpload(event)}
              disabled={uploading}
            />
            <button
              type='button'
              className='secondary-btn patient-attach-records-modal__upload-btn'
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className='spin' aria-hidden />{' '}
                  {progressLabel ?? 'Uploading…'}
                </>
              ) : (
                <>
                  <CloudUpload size={16} aria-hidden /> Choose files to upload
                </>
              )}
            </button>
          </section>
        </div>

        <div className='elixhealth-modal-footer'>
          <button type='button' className='secondary-btn' onClick={onClose} disabled={uploading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

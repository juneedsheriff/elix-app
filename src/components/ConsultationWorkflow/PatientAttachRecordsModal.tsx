import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { CloudUpload, FileText, Loader2, X } from 'lucide-react';
import { useSupabase } from '../../context/SupabaseProvider';
import { patientAttachRecordsToRequest } from '../../lib/opinionRequests';
import {
  fetchUserMedicalRecords,
  medicalFileValidationError,
  uploadMedicalRecord
} from '../../lib/records';
import { truncateFileName } from '../../lib/truncateLabel';
import type { MedicalRecord } from '../../types/medicalRecord';

const ACCEPT = '.pdf,.jpg,.jpeg,.doc,.docx';

type PatientAttachRecordsModalProps = {
  open: boolean;
  requestId: string;
  attachedRecordIds: string[];
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onAttached: () => void;
};

export default function PatientAttachRecordsModal({
  open,
  requestId,
  attachedRecordIds,
  onClose,
  onSuccess,
  onError,
  onAttached
}: PatientAttachRecordsModalProps) {
  const { user } = useSupabase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [vaultRecords, setVaultRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const attachedSet = new Set(attachedRecordIds);

  const loadVaultRecords = useCallback(async () => {
    if (!user?.id) {
      setVaultRecords([]);
      setLoadError(null);
      return;
    }

    setLoading(true);
    setLoadError(null);
    const { data, error } = await fetchUserMedicalRecords(user.id);
    setLoading(false);

    if (error) {
      setLoadError(error.message);
      setVaultRecords([]);
      return;
    }

    setVaultRecords(data ?? []);
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set());
    void loadVaultRecords();
  }, [open, loadVaultRecords]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting && !uploading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, submitting, uploading]);

  const toggleRecord = (id: string) => {
    if (attachedSet.has(id)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user?.id) return;

    const validationError = medicalFileValidationError(file);
    if (validationError) {
      onError(validationError);
      return;
    }

    setUploading(true);
    const { data, error } = await uploadMedicalRecord(file, user.id);
    setUploading(false);

    if (error) {
      onError(error.message);
      return;
    }

    if (!data) {
      onError('Upload failed. Please try again.');
      return;
    }

    setVaultRecords((prev) => [data, ...prev.filter((record) => record.id !== data.id)]);
    setSelectedIds((prev) => new Set(prev).add(data.id));
    onSuccess(`"${truncateFileName(data.file_name)}" uploaded and selected.`);
  };

  const handleSubmit = async () => {
    if (!selectedIds.size) {
      onError('Select at least one record or upload a new file.');
      return;
    }

    setSubmitting(true);
    const { data, error } = await patientAttachRecordsToRequest(requestId, [...selectedIds]);
    setSubmitting(false);

    if (error) {
      onError(error.message);
      return;
    }

    const count = data?.attachedCount ?? selectedIds.size;
    onSuccess(
      count === 1
        ? '1 document added to this request. Our care team will review it.'
        : `${count} documents added to this request. Our care team will review them.`
    );
    onAttached();
    onClose();
  };

  if (!open) return null;

  const selectableRecords = vaultRecords.filter((record) => !attachedSet.has(record.id));

  return (
    <div className='elixhealth-modal-root patient-records-modal-root' role='presentation'>
      <button
        type='button'
        className='elixhealth-modal-backdrop'
        onClick={onClose}
        aria-label='Close add records'
        disabled={submitting || uploading}
      />
      <div
        className='elixhealth-modal patient-records-modal patient-attach-records-modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='patient-attach-records-modal-title'
      >
        <div className='elixhealth-modal-head'>
          <div>
            <h2 id='patient-attach-records-modal-title'>Add medical records</h2>
            <p className='muted'>Select files from your vault or upload a new record for this request.</p>
          </div>
          <button
            type='button'
            className='icon-btn elixhealth-modal-close'
            onClick={onClose}
            aria-label='Close'
            disabled={submitting || uploading}
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className='elixhealth-modal-body patient-attach-records-modal__body'>
          <section className='patient-attach-records-modal__section' aria-labelledby='attach-vault-heading'>
            <h3 id='attach-vault-heading' className='patient-attach-records-modal__heading'>
              From your records vault
            </h3>
            {!user?.id ? (
              <p className='muted'>Sign in as a patient to see your uploaded records.</p>
            ) : loading ? (
              <p className='doctor-status'>
                <Loader2 size={18} className='spin' aria-hidden /> Loading your records…
              </p>
            ) : loadError ? (
              <p className='auth-error' role='alert'>
                {loadError}
              </p>
            ) : selectableRecords.length === 0 ? (
              <p className='muted'>
                {vaultRecords.length > 0
                  ? 'All of your vault records are already on this request.'
                  : 'No records in your vault yet. Upload a new file below.'}
              </p>
            ) : (
              <ul className='record-select-list patient-attach-records-modal__list'>
                {selectableRecords.map((record) => (
                  <li key={record.id}>
                    <label className='record-select-item'>
                      <input
                        type='checkbox'
                        checked={selectedIds.has(record.id)}
                        onChange={() => toggleRecord(record.id)}
                        disabled={submitting || uploading}
                      />
                      <FileText size={20} aria-hidden />
                      <span className='record-select-text'>
                        <strong title={record.file_name}>{truncateFileName(record.file_name)}</strong>
                        {record.summary ? <span className='muted'>{record.summary}</span> : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className='patient-attach-records-modal__section' aria-labelledby='attach-upload-heading'>
            <h3 id='attach-upload-heading' className='patient-attach-records-modal__heading'>
              Upload new record
            </h3>
            <p className='muted patient-attach-records-modal__hint'>
              PDF, JPG, or DOC/DOCX up to 10 MB. New uploads are saved to your vault and selected
              automatically.
            </p>
            <input
              ref={fileInputRef}
              type='file'
              accept={ACCEPT}
              className='patient-attach-records-modal__file-input'
              onChange={(event) => void handleUpload(event)}
              disabled={!user?.id || submitting || uploading}
            />
            <button
              type='button'
              className='secondary-btn patient-attach-records-modal__upload-btn'
              onClick={() => fileInputRef.current?.click()}
              disabled={!user?.id || submitting || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className='spin' aria-hidden /> Uploading…
                </>
              ) : (
                <>
                  <CloudUpload size={16} aria-hidden /> Choose file to upload
                </>
              )}
            </button>
          </section>
        </div>

        <div className='elixhealth-modal-footer'>
          <button
            type='button'
            className='secondary-btn'
            onClick={onClose}
            disabled={submitting || uploading}
          >
            Cancel
          </button>
          <button
            type='button'
            className='primary-btn'
            onClick={() => void handleSubmit()}
            disabled={submitting || uploading || !selectedIds.size}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className='spin' aria-hidden /> Submitting…
              </>
            ) : (
              `Submit${selectedIds.size ? ` (${selectedIds.size})` : ''}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

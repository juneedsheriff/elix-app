import { useEffect, useState } from 'react';
import { ExternalLink, FileText, Loader2, Trash2, X } from 'lucide-react';
import { patientDetachRecordFromRequest } from '../../lib/opinionRequests';
import type { OpinionRequestFile } from '../../types/opinionRequest';

type PatientRequestRecordsModalProps = {
  open: boolean;
  requestId: string;
  records: OpinionRequestFile[];
  canManage?: boolean;
  onClose: () => void;
  onOpenRecord: (storagePath: string) => void;
  onAddMore?: () => void;
  onDetached?: () => void;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
};

export default function PatientRequestRecordsModal({
  open,
  requestId,
  records,
  canManage = false,
  onClose,
  onOpenRecord,
  onAddMore,
  onDetached,
  onSuccess,
  onError
}: PatientRequestRecordsModalProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !removingId) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, removingId]);

  useEffect(() => {
    if (!open) setRemovingId(null);
  }, [open]);

  const handleRemove = async (record: OpinionRequestFile) => {
    const confirmed = window.confirm(
      `Remove "${record.file_name}" from this request? The file stays in your records vault.`
    );
    if (!confirmed) return;

    setRemovingId(record.id);
    const { error } = await patientDetachRecordFromRequest(requestId, record.id);
    setRemovingId(null);

    if (error) {
      onError?.(error.message);
      return;
    }

    onSuccess?.(`"${record.file_name}" removed from this request.`);
    onDetached?.();
  };

  if (!open) return null;

  return (
    <div className='elixhealth-modal-root patient-records-modal-root' role='presentation'>
      <button
        type='button'
        className='elixhealth-modal-backdrop'
        onClick={onClose}
        aria-label='Close documents'
        disabled={Boolean(removingId)}
      />
      <div
        className='elixhealth-modal patient-records-modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='patient-records-modal-title'
      >
        <div className='elixhealth-modal-head patient-records-modal__head'>
          <div className='patient-records-modal__head-copy'>
            <h2 id='patient-records-modal-title'>Your documents</h2>
            <p className='patient-records-modal__subtitle'>
              {records.length} file{records.length === 1 ? '' : 's'} attached to this request
              {canManage ? '. You can remove files or add more before verification.' : '.'}
            </p>
          </div>
          <button
            type='button'
            className='icon-btn elixhealth-modal-close'
            onClick={onClose}
            aria-label='Close'
            disabled={Boolean(removingId)}
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className='elixhealth-modal-body patient-records-modal__body'>
          {records.length === 0 ? (
            <p className='patient-records-modal__empty'>No documents on this request.</p>
          ) : (
            <ul className='patient-records-modal__list'>
              {records.map((record) => (
                <li key={record.id}>
                  <article className='patient-records-modal__card'>
                    <div className='patient-records-modal__card-main'>
                      <span className='patient-records-modal__file-icon' aria-hidden>
                        <FileText size={20} />
                      </span>
                      <div className='patient-records-modal__file-copy'>
                        <p className='patient-records-modal__file-name' title={record.file_name}>
                          {record.file_name}
                        </p>
                        {record.summary ? (
                          <p className='patient-records-modal__file-summary'>{record.summary}</p>
                        ) : (
                          <p className='patient-records-modal__file-summary'>Medical record</p>
                        )}
                      </div>
                    </div>

                    <div className='patient-records-modal__card-actions'>
                      {record.storage_path ? (
                        <button
                          type='button'
                          className='secondary-btn patient-records-modal__view-btn'
                          onClick={() => onOpenRecord(record.storage_path!)}
                          disabled={Boolean(removingId)}
                        >
                          <ExternalLink size={16} aria-hidden />
                          View file
                        </button>
                      ) : null}
                      {canManage ? (
                        <button
                          type='button'
                          className='patient-records-modal__remove-btn'
                          onClick={() => void handleRemove(record)}
                          disabled={Boolean(removingId)}
                          aria-label={`Remove ${record.file_name} from request`}
                        >
                          {removingId === record.id ? (
                            <Loader2 size={16} className='spin' aria-hidden />
                          ) : (
                            <Trash2 size={16} aria-hidden />
                          )}
                          <span>Remove</span>
                        </button>
                      ) : null}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className='elixhealth-modal-footer patient-records-modal__footer'>
          {canManage && onAddMore ? (
            <button
              type='button'
              className='primary-btn patient-records-modal__add-btn'
              onClick={onAddMore}
              disabled={Boolean(removingId)}
            >
              Add more records
            </button>
          ) : null}
          <button
            type='button'
            className='secondary-btn patient-records-modal__close-btn'
            onClick={onClose}
            disabled={Boolean(removingId)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { FileText, X } from 'lucide-react';
import type { OpinionRequestFile } from '../../types/opinionRequest';

type PatientRequestRecordsModalProps = {
  open: boolean;
  records: OpinionRequestFile[];
  onClose: () => void;
  onOpenRecord: (storagePath: string) => void;
};

export default function PatientRequestRecordsModal({
  open,
  records,
  onClose,
  onOpenRecord
}: PatientRequestRecordsModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className='elixhealth-modal-root patient-records-modal-root' role='presentation'>
      <button
        type='button'
        className='elixhealth-modal-backdrop'
        onClick={onClose}
        aria-label='Close documents'
      />
      <div
        className='elixhealth-modal patient-records-modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='patient-records-modal-title'
      >
        <div className='elixhealth-modal-head'>
          <div>
            <h2 id='patient-records-modal-title'>Your documents</h2>
            <p className='muted'>
              {records.length} file{records.length === 1 ? '' : 's'} attached to this request
            </p>
          </div>
          <button
            type='button'
            className='icon-btn elixhealth-modal-close'
            onClick={onClose}
            aria-label='Close'
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className='elixhealth-modal-body'>
          {records.length === 0 ? (
            <p className='muted'>No documents on this request.</p>
          ) : (
            <ul className='record-select-list doctor-request-files patient-records-modal__list'>
              {records.map((record) => (
                <li key={record.id}>
                  <div className='record-select-item doctor-request-file-row'>
                    <FileText size={18} aria-hidden />
                    <span className='record-select-text'>
                      <strong>{record.file_name}</strong>
                      {record.summary ? <span className='muted'>{record.summary}</span> : null}
                    </span>
                    {record.storage_path ? (
                      <button
                        type='button'
                        className='text-btn'
                        onClick={() => onOpenRecord(record.storage_path!)}
                      >
                        Open
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className='elixhealth-modal-footer'>
          <button type='button' className='secondary-btn' onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

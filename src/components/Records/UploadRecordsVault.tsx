import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { FileText, Loader2, Upload } from 'lucide-react';
import {
  deleteMedicalRecord,
  fetchUserMedicalRecords,
  getMedicalRecordDownloadUrl,
  medicalFileValidationError,
  isR2StorageConfigured,
  uploadMedicalRecord
} from '../../lib/records';
import type { MedicalRecord } from '../../types/medicalRecord';

const ACCEPT = '.pdf,.jpg,.jpeg,.doc,.docx';

function formatUploadedAt(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Uploaded just now';
  if (mins < 60) return `Uploaded ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Uploaded ${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Uploaded ${days} day${days === 1 ? '' : 's'} ago`;
  return `Uploaded ${date.toLocaleDateString()}`;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type UploadRecordsVaultProps = {
  configured: boolean;
  userId: string | null;
};

export default function UploadRecordsVault({ configured, userId }: UploadRecordsVaultProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const loadRecords = useCallback(async () => {
    if (!userId) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await fetchUserMedicalRecords(userId);
    if (fetchError) {
      setError(fetchError.message);
      setRecords([]);
    } else {
      setRecords(data ?? []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const processFiles = async (files: FileList | File[]) => {
    if (!userId) {
      setUploadMessage('Sign in to upload medical records.');
      return;
    }
    if (!configured) {
      setUploadMessage('Connect Supabase to enable uploads.');
      return;
    }
    if (!isR2StorageConfigured()) {
      setUploadMessage('Set VITE_R2_API_URL to your Cloudflare Worker URL, then restart the dev server.');
      return;
    }

    const list = Array.from(files);
    if (!list.length) return;

    setUploading(true);
    setUploadMessage(null);

    let successCount = 0;
    const errors: string[] = [];

    for (const file of list) {
      const validation = medicalFileValidationError(file);
      if (validation) {
        errors.push(validation);
        continue;
      }

      const { error: uploadError } = await uploadMedicalRecord(file, userId);
      if (uploadError) {
        errors.push(uploadError.message);
      } else {
        successCount += 1;
      }
    }

    await loadRecords();
    setUploading(false);

    if (successCount > 0) {
      setUploadMessage(
        errors.length
          ? `${successCount} file(s) uploaded. ${errors.length} failed.`
          : `${successCount} file(s) uploaded successfully.`
      );
    } else if (errors.length) {
      setUploadMessage(errors[0]);
    }
  };

  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files?.length) void processFiles(files);
    event.target.value = '';
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer.files?.length) void processFiles(event.dataTransfer.files);
  };

  const onOpenFile = async (record: MedicalRecord) => {
    if (!record.storage_path) return;
    const { data, error: urlError } = await getMedicalRecordDownloadUrl(record.storage_path);
    if (urlError || !data?.signedUrl) {
      setUploadMessage(urlError?.message ?? 'Could not open file.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const onDelete = async (record: MedicalRecord) => {
    const { error: deleteError } = await deleteMedicalRecord(record);
    if (deleteError) {
      setUploadMessage(deleteError.message);
      return;
    }
    await loadRecords();
    setUploadMessage('Record removed.');
  };

  return (
    <div className='screen-grid'>
      <section className='section-card'>
        <div className='section-head'>
          <h3>Medical records vault</h3>
          <p>HIPAA and GDPR compliant encrypted storage on Cloudflare R2</p>
        </div>

        {!userId ? (
          <p className='auth-error' role='alert'>
            Sign in to upload and store your medical records.
          </p>
        ) : null}

        {!configured ? (
          <p className='auth-error' role='alert'>
            Add VITE_SUPABASE_* to .env.local, run migrations, then restart the dev server.
          </p>
        ) : null}

        {configured && !isR2StorageConfigured() ? (
          <p className='auth-error' role='alert'>
            Add VITE_R2_API_URL (Cloudflare Worker for R2) to .env.local, deploy{' '}
            <code>workers/medical-records</code>, then restart the dev server.
          </p>
        ) : null}

        <div
          className={`dropzone ${dragOver ? 'dropzone-active' : ''} ${uploading ? 'dropzone-busy' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          role='button'
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
          }}
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={28} aria-hidden />
          <h4>Drag and drop files here</h4>
          <p>Supported: PDF, JPG, DOC, DOCX (max 10 MB each)</p>
          <button
            type='button'
            className='primary-btn'
            disabled={uploading || !userId || !configured || !isR2StorageConfigured()}
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            {uploading ? 'Uploading…' : 'Select files'}
          </button>
          <input
            ref={inputRef}
            type='file'
            className='sr-only'
            accept={ACCEPT}
            multiple
            onChange={onFileInput}
            disabled={uploading || !userId || !configured || !isR2StorageConfigured()}
            aria-label='Select medical record files'
          />
        </div>

        <div className='feature-row'>
          <span className='tag'>PDF</span>
          <span className='tag'>JPG</span>
          <span className='tag'>DOC</span>
        </div>

        {uploadMessage ? (
          <p className={uploadMessage.includes('failed') || uploadMessage.includes('not') ? 'auth-error' : 'muted'} role='status'>
            {uploadMessage}
          </p>
        ) : null}
      </section>

      <section className='section-card'>
        <div className='section-head'>
          <h3>Your uploads</h3>
          <p>{records.length} file{records.length === 1 ? '' : 's'} in your vault</p>
        </div>

        {loading ? (
          <p className='doctor-status'>
            <Loader2 size={18} className='spin' aria-hidden /> Loading records…
          </p>
        ) : null}

        {error ? (
          <p className='auth-error' role='alert'>
            {error}. Run <code>supabase/schema.sql</code> in the Supabase SQL Editor.
          </p>
        ) : null}

        {!loading && !error && !userId ? (
          <p className='muted'>No records yet. Sign in to upload files.</p>
        ) : null}

        {!loading && !error && userId && records.length === 0 ? (
          <p className='muted'>No uploads yet. Add your first PDF, JPG, or DOC file above.</p>
        ) : null}

        {!loading && !error && records.length > 0 ? (
          <ul className='list record-upload-list'>
            {records.map((record) => (
              <li key={record.id}>
                <div className='record-upload-row'>
                  <FileText size={20} aria-hidden />
                  <div className='record-upload-text'>
                    <strong>{record.file_name}</strong>
                    <span>
                      {formatFileSize(record.file_size_bytes)}
                      {' • '}
                      {formatUploadedAt(record.uploaded_at)}
                      {record.summary ? ` • ${record.summary}` : ''}
                    </span>
                  </div>
                </div>
                <div className='record-upload-actions'>
                  {record.storage_path ? (
                    <button type='button' className='text-btn' onClick={() => void onOpenFile(record)}>
                      Open
                    </button>
                  ) : null}
                  <button type='button' className='text-btn' onClick={() => void onDelete(record)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

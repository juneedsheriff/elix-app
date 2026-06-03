import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent
} from 'react';
import {
  Check,
  ChevronRight,
  CloudUpload,
  FolderOpen,
  Loader2,
  Lock,
  MoreVertical,
  Search,
  SlidersHorizontal
} from 'lucide-react';
import RecordFileTypeIcon, {
  recordFileIconType,
  recordFileIconTypeFromPill
} from './RecordFileTypeIcon';
import { fetchPatientConsultationSummaries } from '../../lib/opinionRequests';
import {
  deleteMedicalRecord,
  fetchUserMedicalRecords,
  getMedicalRecordDownloadUrl,
  medicalFileValidationError,
  isR2StorageConfigured,
  uploadMedicalRecord
} from '../../lib/records';
import type { ConsultationSummary } from '../../types/opinionRequest';
import type { MedicalRecord } from '../../types/medicalRecord';
import './upload-records.css';

const ACCEPT = '.pdf,.jpg,.jpeg,.doc,.docx';

type FileFilter = 'all' | 'pdf' | 'image' | 'doc';
type FormatPill = 'PDF' | 'JPG' | 'DOC' | 'DOCX';

function fileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function relativeUploadLabel(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString();
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeCategory(record: MedicalRecord): FileFilter {
  const ext = fileExtension(record.file_name);
  if (ext === 'pdf') return 'pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'image';
  if (ext === 'doc' || ext === 'docx') return 'doc';
  return 'all';
}

function matchesFilter(record: MedicalRecord, filter: FileFilter): boolean {
  if (filter === 'all') return true;
  return fileTypeCategory(record) === filter;
}

function matchesFormatPill(record: MedicalRecord, pill: FormatPill | null): boolean {
  if (!pill) return true;
  const ext = fileExtension(record.file_name);
  if (pill === 'PDF') return ext === 'pdf';
  if (pill === 'JPG') return ext === 'jpg' || ext === 'jpeg';
  if (pill === 'DOC') return ext === 'doc';
  if (pill === 'DOCX') return ext === 'docx';
  return true;
}

type UploadRecordsVaultProps = {
  configured: boolean;
  userId: string | null;
};

export default function UploadRecordsVault({ configured, userId }: UploadRecordsVaultProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const vaultBannerRef = useRef<HTMLElement>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [summaries, setSummaries] = useState<ConsultationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fileFilter, setFileFilter] = useState<FileFilter>('all');
  const [formatPill, setFormatPill] = useState<FormatPill | null>(null);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const canUpload = Boolean(userId && configured && isR2StorageConfigured());

  const loadRecords = useCallback(async () => {
    if (!userId) {
      setRecords([]);
      setSummaries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const [recordsRes, summariesRes] = await Promise.all([
      fetchUserMedicalRecords(userId),
      fetchPatientConsultationSummaries(userId)
    ]);
    if (recordsRes.error) {
      setError(recordsRes.error.message);
      setRecords([]);
    } else {
      setRecords(recordsRes.data ?? []);
    }
    if (!summariesRes.error) {
      setSummaries(summariesRes.data ?? []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (!openMenuId && !filterMenuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.urv-file-item__menu-wrap') && !target.closest('.urv-filter-wrap')) {
        setOpenMenuId(null);
        setFilterMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [openMenuId, filterMenuOpen]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((record) => {
      if (!matchesFilter(record, fileFilter)) return false;
      if (!matchesFormatPill(record, formatPill)) return false;
      if (q && !record.file_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [records, searchQuery, fileFilter, formatPill]);

  const uploadIsError =
    uploadMessage != null &&
    (uploadMessage.includes('failed') ||
      uploadMessage.includes('not') ||
      uploadMessage.includes('Sign in') ||
      uploadMessage.includes('Connect') ||
      uploadMessage.includes('Set VITE'));

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
    setOpenMenuId(null);
    if (!record.storage_path) return;
    const { data, error: urlError } = await getMedicalRecordDownloadUrl(record.storage_path);
    if (urlError || !data?.signedUrl) {
      setUploadMessage(urlError?.message ?? 'Could not open file.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const onDelete = async (record: MedicalRecord) => {
    setOpenMenuId(null);
    const { error: deleteError } = await deleteMedicalRecord(record);
    if (deleteError) {
      setUploadMessage(deleteError.message);
      return;
    }
    await loadRecords();
    setUploadMessage('Record removed.');
  };

  const filterLabel =
    fileFilter === 'all'
      ? 'All files'
      : fileFilter === 'pdf'
        ? 'PDF only'
        : fileFilter === 'image'
          ? 'Images only'
          : 'Documents only';

  return (
    <div className='screen-grid upload-records-vault'>
      <div className='urv-shell'>
        {!userId ? (
          <p className='urv-alert urv-alert--error' role='alert'>
            Sign in to upload and store your medical records.
          </p>
        ) : null}

        {!configured ? (
          <p className='urv-alert urv-alert--error' role='alert'>
            Add VITE_SUPABASE_* to .env.local, run migrations, then restart the dev server.
          </p>
        ) : null}

        {configured && !isR2StorageConfigured() ? (
          <p className='urv-alert urv-alert--error' role='alert'>
            Add VITE_R2_API_URL (Cloudflare Worker for R2) to .env.local, deploy{' '}
            <code>workers/medical-records</code>, then restart the dev server.
          </p>
        ) : null}

        {uploadMessage ? (
          <p
            className={`urv-alert ${uploadIsError ? 'urv-alert--error' : 'urv-alert--success'}`}
            role='status'
          >
            {uploadMessage}
          </p>
        ) : null}

        <section
          ref={vaultBannerRef}
          className='urv-vault-banner'
          aria-labelledby='urv-vault-heading'
          id='urv-security'
        >
          <div className='urv-vault-banner__content'>
            <h2 id='urv-vault-heading' className='urv-vault-banner__title'>
              Medical records vault
            </h2>
            <p className='urv-vault-banner__text'>
              HIPAA and GDPR compliant encrypted storage on Cloudflare R2
            </p>
            <div className='urv-vault-banner__badges'>
              <span className='urv-compliance-badge'>
                <Check size={12} strokeWidth={3} aria-hidden />
                HIPAA Compliant
              </span>
              <span className='urv-compliance-badge'>
                <Check size={12} strokeWidth={3} aria-hidden />
                GDPR Compliant
              </span>
            </div>
          </div>
          <div className='urv-vault-banner__art' aria-hidden>
            <img
              src='/icons/vault-shield.png'
              alt=''
              className='urv-vault-banner__shield-img'
              width={88}
              height={88}
              decoding='async'
            />
          </div>
        </section>

        <section className='urv-upload-card' aria-labelledby='urv-upload-heading'>
          <div
            className={`urv-dropzone ${dragOver ? 'urv-dropzone--active' : ''} ${uploading ? 'urv-dropzone--busy' : ''}`}
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
            aria-labelledby='urv-upload-heading'
          >
            <span className='urv-dropzone__icon' aria-hidden>
              <CloudUpload size={26} strokeWidth={2} />
            </span>
            <h3 id='urv-upload-heading' className='urv-dropzone__title'>
              Drag and drop files here
            </h3>
            <p className='urv-dropzone__hint'>Supported: PDF, JPG, DOC, DOCX (max 10 MB each)</p>
            <button
              type='button'
              className='urv-select-btn'
              disabled={uploading || !canUpload}
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              <FolderOpen size={17} aria-hidden />
              {uploading ? 'Uploading…' : 'Select files'}
            </button>
            <input
              ref={inputRef}
              type='file'
              className='sr-only'
              accept={ACCEPT}
              multiple
              onChange={onFileInput}
              disabled={uploading || !canUpload}
              aria-label='Select medical record files'
            />
          </div>

          <div className='urv-format-pills' role='group' aria-label='Filter uploads by file type'>
            {(['PDF', 'JPG', 'DOC', 'DOCX'] as const).map((pill) => (
              <button
                key={pill}
                type='button'
                className={`urv-format-pill urv-format-pill--${pill.toLowerCase()} ${formatPill === pill ? 'urv-format-pill--active' : ''}`}
                aria-pressed={formatPill === pill}
                onClick={() => setFormatPill((current) => (current === pill ? null : pill))}
              >
                <RecordFileTypeIcon type={recordFileIconTypeFromPill(pill)} size='sm' />
                {pill}
              </button>
            ))}
          </div>

          <p className='urv-upload-footer'>
            <Lock size={13} aria-hidden />
            <span>Your files are encrypted and stored securely.</span>
            <button
              type='button'
              className='urv-learn-more'
              onClick={() => vaultBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
            >
              Learn more
              <ChevronRight size={12} aria-hidden />
            </button>
          </p>
        </section>

        <section className='urv-files-section' aria-labelledby='urv-files-heading'>
          <div className='urv-files-section__head'>
            <h2 id='urv-files-heading' className='urv-files-section__title'>
              Your uploads
            </h2>
            <p className='urv-files-section__sub'>
              {records.length} file{records.length === 1 ? '' : 's'} in your vault
              {filteredRecords.length !== records.length
                ? ` · showing ${filteredRecords.length}`
                : ''}
            </p>
          </div>

          {userId && records.length > 0 ? (
            <div className='urv-files-toolbar'>
              <label className='urv-search'>
                <Search size={16} aria-hidden />
                <input
                  type='search'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder='Search files'
                  aria-label='Search uploaded files'
                />
              </label>
              <div className='urv-filter-wrap'>
                <button
                  type='button'
                  className={`urv-filter-btn ${filterMenuOpen ? 'urv-filter-btn--open' : ''}`}
                  onClick={() => setFilterMenuOpen((open) => !open)}
                  aria-label={`Filter files: ${filterLabel}`}
                  aria-expanded={filterMenuOpen}
                  aria-haspopup='listbox'
                >
                  <SlidersHorizontal size={17} aria-hidden />
                </button>
                {filterMenuOpen ? (
                  <ul className='urv-filter-menu' role='listbox' aria-label='File type filter'>
                    {(
                      [
                        ['all', 'All files'],
                        ['pdf', 'PDF only'],
                        ['image', 'Images only'],
                        ['doc', 'Documents only']
                      ] as const
                    ).map(([value, label]) => (
                      <li key={value}>
                        <button
                          type='button'
                          role='option'
                          aria-selected={fileFilter === value}
                          aria-pressed={fileFilter === value}
                          onClick={() => {
                            setFileFilter(value);
                            setFilterMenuOpen(false);
                          }}
                        >
                          {label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}

          {loading ? (
            <p className='urv-loading'>
              <Loader2 size={18} className='spin' aria-hidden /> Loading records…
            </p>
          ) : null}

          {error ? (
            <p className='urv-alert urv-alert--error' role='alert'>
              {error}. Run <code>supabase/schema.sql</code> in the Supabase SQL Editor.
            </p>
          ) : null}

          {!loading && !error && !userId ? (
            <p className='urv-empty'>No records yet. Sign in to upload files.</p>
          ) : null}

          {!loading && !error && userId && records.length === 0 ? (
            <p className='urv-empty'>No uploads yet. Add your first PDF, JPG, or DOC file above.</p>
          ) : null}

          {!loading && !error && userId && records.length > 0 && filteredRecords.length === 0 ? (
            <p className='urv-empty'>No files match your search or filter.</p>
          ) : null}

          {!loading && !error && filteredRecords.length > 0 ? (
            <ul className='urv-file-list'>
              {filteredRecords.map((record) => {
                const fileIcon = recordFileIconType(record.file_name);
                const uploadedDate = new Date(record.uploaded_at).toLocaleDateString();

                return (
                  <li key={record.id} className='urv-file-item'>
                    <RecordFileTypeIcon type={fileIcon} size='lg' className='urv-file-item__type-icon' />
                    <div className='urv-file-item__main'>
                      <p className='urv-file-item__name'>{record.file_name}</p>
                      <p className='urv-file-item__meta'>
                        <span>
                          {formatFileSize(record.file_size_bytes)} • Uploaded {uploadedDate}
                        </span>
                        <span>
                          {relativeUploadLabel(record.uploaded_at)}
                          {record.summary ? ` • ${record.summary}` : ''}
                        </span>
                      </p>
                    </div>
                    <div className='urv-file-item__menu-wrap'>
                      <button
                        type='button'
                        className='urv-file-item__menu-btn'
                        onClick={() =>
                          setOpenMenuId((id) => (id === record.id ? null : record.id))
                        }
                        aria-label={`Actions for ${record.file_name}`}
                        aria-expanded={openMenuId === record.id}
                        aria-haspopup='menu'
                      >
                        <MoreVertical size={18} aria-hidden />
                      </button>
                      {openMenuId === record.id ? (
                        <ul className='urv-file-item__menu' role='menu'>
                          {record.storage_path ? (
                            <li>
                              <button type='button' role='menuitem' onClick={() => void onOpenFile(record)}>
                                Open
                              </button>
                            </li>
                          ) : null}
                          <li>
                            <button
                              type='button'
                              role='menuitem'
                              className='danger'
                              onClick={() => void onDelete(record)}
                            >
                              Remove
                            </button>
                          </li>
                        </ul>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>

        {summaries.length > 0 ? (
          <section className='urv-summaries' aria-labelledby='urv-summaries-heading'>
            <h2 id='urv-summaries-heading' className='urv-summaries__title'>
              Consultation summaries
            </h2>
            <p className='urv-summaries__sub'>
              Structured notes and prescriptions from completed consultations
            </p>
            <ul className='urv-summary-list'>
              {summaries.map((summary) => (
                <li key={summary.id} className='urv-summary-item'>
                  <strong>{summary.chief_complaint ?? 'Consultation'}</strong>
                  <span>
                    {summary.prescription
                      ? `Prescription: ${summary.prescription}`
                      : summary.assessment_plan ?? ''}
                  </span>
                  <span>{new Date(summary.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

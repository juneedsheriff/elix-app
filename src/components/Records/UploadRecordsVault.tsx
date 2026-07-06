import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type DragEvent
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  CloudUpload,
  Download,
  FolderOpen,
  Link2,
  Loader2,
  Lock,
  MoreVertical,
  Search,
  SlidersHorizontal
} from 'lucide-react';
import RecordFileTypeIcon, { recordFileIconType } from './RecordFileTypeIcon';
import { fetchPatientConsultationSummaries } from '../../lib/opinionRequests';
import {
  downloadLabOrderPdf,
  downloadPrescriptionOrderPdf
} from '../../lib/consultationOrdersPdf';
import {
  getPendingOpinionRequest,
  navigateToResumePendingOpinionRequest
} from '../../lib/navigation/pendingOpinionRequest';
import {
  DEFAULT_MEDICAL_RECORD_CATEGORY,
  isExternalOnlyCategory,
  isGoogleDriveShareUrl,
  MEDICAL_RECORD_CATEGORIES,
  MEDICAL_RECORD_VIEW_FILTERS,
  medicalRecordCategoryLabel,
  type MedicalRecordCategoryId,
  type MedicalRecordViewFilterId
} from '../../lib/medicalRecordCategories';
import {
  deleteMedicalRecord,
  fetchUserMedicalRecords,
  medicalFileValidationError,
  isR2StorageConfigured,
  openMedicalRecordFile,
  saveExternalMedicalRecordLink,
  uploadMedicalRecord
} from '../../lib/records';
import type { ConsultationSummary } from '../../types/opinionRequest';
import type { MedicalRecord } from '../../types/medicalRecord';
import './upload-records.css';

const ACCEPT = '.pdf,.jpg,.jpeg,.doc,.docx';

type VaultTab = 'view' | 'upload';

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

function recordCategoryId(record: MedicalRecord): MedicalRecordCategoryId {
  const raw = record.record_category;
  if (raw && MEDICAL_RECORD_CATEGORIES.some((category) => category.id === raw)) {
    return raw as MedicalRecordCategoryId;
  }
  if (record.external_url?.trim()) return 'dicom_file';
  return DEFAULT_MEDICAL_RECORD_CATEGORY;
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

type UploadRecordsVaultProps = {
  configured: boolean;
  userId: string | null;
  onNavigate?: (screenId: string) => void;
};

export default function UploadRecordsVault({ configured, userId, onNavigate }: UploadRecordsVaultProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const vaultBannerRef = useRef<HTMLElement>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const initialTabResolvedRef = useRef(false);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [summaries, setSummaries] = useState<ConsultationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<MedicalRecordViewFilterId>('all');
  const [activeTab, setActiveTab] = useState<VaultTab>('upload');
  const [uploadCategory, setUploadCategory] = useState<MedicalRecordCategoryId | ''>('');
  const [dicomDriveUrl, setDicomDriveUrl] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [categoryFilterMenuOpen, setCategoryFilterMenuOpen] = useState(false);
  const [filterMenuStyle, setFilterMenuStyle] = useState<CSSProperties>({});
  const [recordPendingDelete, setRecordPendingDelete] = useState<MedicalRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState(false);
  const [downloadingOrderKey, setDownloadingOrderKey] = useState<string | null>(null);

  const canUpload = Boolean(userId && configured && isR2StorageConfigured());
  const showTabs = !loading && records.length > 0;
  const hasUploadCategory = uploadCategory !== '';
  const isDicomUpload = hasUploadCategory && isExternalOnlyCategory(uploadCategory);

  const activeCategoryFilterLabel = useMemo(
    () =>
      MEDICAL_RECORD_VIEW_FILTERS.find((filter) => filter.id === categoryFilter)?.label ?? 'All records',
    [categoryFilter]
  );

  const updateFilterMenuPosition = useCallback(() => {
    const button = filterBtnRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const menuWidth = 280;
    const viewportPadding = 12;
    const left = Math.min(
      Math.max(viewportPadding, rect.right - menuWidth),
      window.innerWidth - menuWidth - viewportPadding
    );

    setFilterMenuStyle({
      top: rect.bottom + 6,
      left
    });
  }, []);

  useLayoutEffect(() => {
    if (!categoryFilterMenuOpen) return;
    updateFilterMenuPosition();
  }, [categoryFilterMenuOpen, updateFilterMenuPosition]);

  useEffect(() => {
    if (!categoryFilterMenuOpen) return;

    const onReposition = () => updateFilterMenuPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);

    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [categoryFilterMenuOpen, updateFilterMenuPosition]);

  useEffect(() => {
    if (!recordPendingDelete || deletingRecord) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRecordPendingDelete(null);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [recordPendingDelete, deletingRecord]);

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
    if (loading) return;

    if (records.length === 0) {
      setActiveTab('upload');
      initialTabResolvedRef.current = true;
      return;
    }

    if (!initialTabResolvedRef.current) {
      initialTabResolvedRef.current = true;
      setActiveTab('view');
    }
  }, [loading, records.length]);

  useEffect(() => {
    if (!openMenuId && !categoryFilterMenuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.urv-file-item__menu-wrap')) {
        setOpenMenuId(null);
      }
      if (!target.closest('.urv-filter-wrap')) {
        setCategoryFilterMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [openMenuId, categoryFilterMenuOpen]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((record) => {
      if (categoryFilter !== 'all' && recordCategoryId(record) !== categoryFilter) return false;
      if (q) {
        const haystack = [
          record.file_name,
          record.summary ?? '',
          medicalRecordCategoryLabel(recordCategoryId(record))
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [records, searchQuery, categoryFilter]);

  const statusIsError =
    statusMessage != null &&
    (statusMessage.includes('failed') ||
      statusMessage.includes('not') ||
      statusMessage.includes('Sign in') ||
      statusMessage.includes('Connect') ||
      statusMessage.includes('Set VITE') ||
      statusMessage.includes('valid Google') ||
      statusMessage.includes('requires migration'));

  const pendingOpinionRequest = getPendingOpinionRequest();
  const showProceedToRequest = Boolean(pendingOpinionRequest && records.length > 0);

  const handleProceedToRequest = () => {
    navigateToResumePendingOpinionRequest(navigate, onNavigate);
  };

  const afterSuccessfulUpload = (message: string) => {
    setStatusMessage(message);
    setDicomDriveUrl('');
    setUploadCategory('');
    setActiveTab('view');
  };

  const processFiles = async (files: FileList | File[]) => {
    if (!userId) {
      setStatusMessage('Sign in to upload medical records.');
      return;
    }
    if (!configured) {
      setStatusMessage('ElixClinix is not configured. Uploads are unavailable.');
      return;
    }
    if (!isR2StorageConfigured()) {
      setStatusMessage('Set VITE_R2_API_URL to your Cloudflare Worker URL, then restart the dev server.');
      return;
    }
    if (!hasUploadCategory) {
      setStatusMessage('Select a record type before uploading.');
      return;
    }
    if (isDicomUpload) {
      setStatusMessage('Select a file category other than DICOM file, or use the Google Drive link form.');
      return;
    }

    const list = Array.from(files);
    if (!list.length) return;

    setUploading(true);
    setStatusMessage(null);

    let successCount = 0;
    const errors: string[] = [];

    for (const file of list) {
      const validation = medicalFileValidationError(file);
      if (validation) {
        errors.push(validation);
        continue;
      }

      const { error: uploadError } = await uploadMedicalRecord(file, userId, {
        category: uploadCategory
      });
      if (uploadError) {
        errors.push(uploadError.message);
      } else {
        successCount += 1;
      }
    }

    await loadRecords();
    setUploading(false);

    if (successCount > 0) {
      const uploadMsg =
        errors.length > 0
          ? String(successCount) +
            ' file(s) uploaded. ' +
            String(errors.length) +
            ' failed.'
          : String(successCount) + ' file(s) uploaded successfully.';
      afterSuccessfulUpload(uploadMsg);
    } else if (errors.length) {
      setStatusMessage(errors[0]);
    }
  };

  const handleSaveDicomLink = async () => {
    if (!userId) {
      setStatusMessage('Sign in to save a DICOM link.');
      return;
    }
    if (uploadCategory !== 'dicom_file') {
      setStatusMessage('Select DICOM file as the record type.');
      return;
    }
    if (!configured) {
      setStatusMessage('ElixClinix is not configured. Uploads are unavailable.');
      return;
    }
    const trimmed = dicomDriveUrl.trim();
    if (!trimmed) {
      setStatusMessage('Paste your Google Drive share link for the DICOM file.');
      return;
    }
    if (!isGoogleDriveShareUrl(trimmed)) {
      setStatusMessage('Enter a valid Google Drive share link (https://drive.google.com/...).');
      return;
    }

    setUploading(true);
    setStatusMessage(null);
    const { error: saveError } = await saveExternalMedicalRecordLink(userId, {
      category: 'dicom_file',
      externalUrl: trimmed
    });
    await loadRecords();
    setUploading(false);

    if (saveError) {
      setStatusMessage(saveError.message);
      return;
    }

    afterSuccessfulUpload('DICOM Google Drive link saved. Our team can access it from your vault.');
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
    const { error: openError } = await openMedicalRecordFile(record);
    if (openError) {
      setStatusMessage(openError.message);
    }
  };

  const requestDelete = (record: MedicalRecord) => {
    setOpenMenuId(null);
    setRecordPendingDelete(record);
  };

  const cancelDelete = () => {
    if (deletingRecord) return;
    setRecordPendingDelete(null);
  };

  const downloadOrder = useCallback(
    async (summary: ConsultationSummary, type: 'prescription' | 'lab') => {
      const text =
        type === 'prescription'
          ? summary.prescription?.trim() ?? ''
          : summary.labs_diagnostics?.trim() ?? '';
      if (!text) return;

      const key = `${summary.id}:${type}`;
      setDownloadingOrderKey(key);
      try {
        const meta = {
          patientName: summary.patient_name,
          patientGender: summary.patient_gender,
          patientId: summary.patient_auth_user_id,
          requestId: summary.request_id,
          doctorName: summary.doctor_name,
          doctorSpecialty: summary.doctor_specialty,
          scheduledAt: summary.scheduled_at,
          issuedAt: new Date(summary.updated_at || summary.created_at)
        };
        if (type === 'prescription') {
          await downloadPrescriptionOrderPdf(text, meta);
        } else {
          await downloadLabOrderPdf(text, meta);
        }
      } finally {
        setDownloadingOrderKey(null);
      }
    },
    []
  );

  const confirmDelete = async () => {
    if (!recordPendingDelete || deletingRecord) return;

    setDeletingRecord(true);
    const { error: deleteError } = await deleteMedicalRecord(recordPendingDelete);
    setDeletingRecord(false);

    if (deleteError) {
      setStatusMessage(deleteError.message);
      return;
    }

    setRecordPendingDelete(null);
    await loadRecords();
    setStatusMessage('Record removed.');
    if (records.length <= 1) {
      setActiveTab('upload');
    }
  };

  const renderUploadPanel = () => (
    <section className='urv-upload-card' aria-labelledby='urv-upload-heading'>
      <div className='urv-upload-category'>
        <label htmlFor='urv-record-category' className='urv-upload-category__label'>
          Record type
        </label>
        <select
          id='urv-record-category'
          className={joinClasses(
            'urv-upload-category__select',
            !hasUploadCategory && 'urv-upload-category__select--placeholder'
          )}
          value={uploadCategory}
          required
          onChange={(event) => {
            const value = event.target.value;
            setUploadCategory(value ? (value as MedicalRecordCategoryId) : '');
            setStatusMessage(null);
          }}
          disabled={uploading}
        >
          <option value='' disabled hidden>
            Select record type
          </option>
          {MEDICAL_RECORD_CATEGORIES.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
      </div>

      {isDicomUpload ? (
        <div className='urv-dicom-panel'>
          <p className='urv-dicom-panel__lead'>
            DICOM imaging files are often too large to upload here. Share a Google Drive link with
            view access instead — our care team will use it during review.
          </p>
          <label htmlFor='urv-dicom-url' className='urv-dicom-panel__label'>
            Google Drive share link
          </label>
          <input
            id='urv-dicom-url'
            type='url'
            className='urv-dicom-panel__input'
            placeholder='https://drive.google.com/file/d/...'
            value={dicomDriveUrl}
            onChange={(event) => setDicomDriveUrl(event.target.value)}
            disabled={uploading || !userId}
          />
          <button
            type='button'
            className='primary-btn urv-dicom-panel__submit'
            disabled={uploading || !userId || !configured || !dicomDriveUrl.trim() || !hasUploadCategory}
            onClick={() => void handleSaveDicomLink()}
          >
            {uploading ? (
              <>
                <Loader2 size={16} className='spin' aria-hidden /> Saving…
              </>
            ) : (
              <>
                <Link2 size={16} aria-hidden /> Save DICOM link
              </>
            )}
          </button>
        </div>
      ) : (
        <>
          <div
            className={joinClasses(
              'urv-dropzone',
              dragOver && 'urv-dropzone--active',
              uploading && 'urv-dropzone--busy',
              !hasUploadCategory && 'urv-dropzone--disabled'
            )}
            onDragOver={(e) => {
              if (!hasUploadCategory) return;
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            role='button'
            tabIndex={hasUploadCategory ? 0 : -1}
            aria-disabled={!hasUploadCategory}
            onKeyDown={(e) => {
              if (!hasUploadCategory) return;
              if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
            }}
            onClick={() => {
              if (!hasUploadCategory) {
                setStatusMessage('Select a record type before uploading.');
                return;
              }
              inputRef.current?.click();
            }}
            aria-labelledby='urv-upload-heading'
          >
            <span className='urv-dropzone__icon' aria-hidden>
              <CloudUpload size={26} strokeWidth={2} />
            </span>
            <h3 id='urv-upload-heading' className='urv-dropzone__title'>
              Drag and drop files here
            </h3>
            <p className='urv-dropzone__hint'>
              {hasUploadCategory
                ? medicalRecordCategoryLabel(uploadCategory) + ' · PDF, JPG, DOC, DOCX (max 10 MB each)'
                : 'Choose a record type above, then upload PDF, JPG, DOC, or DOCX (max 10 MB each).'}
            </p>
            <button
              type='button'
              className='urv-select-btn'
              disabled={uploading || !canUpload || !hasUploadCategory}
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
              disabled={uploading || !canUpload || !hasUploadCategory}
              aria-label='Select medical record files'
            />
          </div>
        </>
      )}

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
  );

  const renderViewPanel = () => (
    <section className='urv-files-section' aria-labelledby='urv-files-heading'>
      <div className='urv-files-section__head'>
        <h2 id='urv-files-heading' className='urv-files-section__title'>
          Your records
        </h2>
        <p className='urv-files-section__sub'>
          {records.length} file{records.length === 1 ? '' : 's'} in your vault
          {filteredRecords.length !== records.length
            ? ' · showing ' + String(filteredRecords.length)
            : ''}
        </p>
      </div>

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
            ref={filterBtnRef}
            type='button'
            className={joinClasses(
              'urv-filter-btn',
              categoryFilterMenuOpen && 'urv-filter-btn--open',
              categoryFilter !== 'all' && 'urv-filter-btn--active'
            )}
            onClick={() =>
              setCategoryFilterMenuOpen((open) => {
                const next = !open;
                if (next) {
                  requestAnimationFrame(() => updateFilterMenuPosition());
                }
                return next;
              })
            }
            aria-label={'Filter by record type: ' + activeCategoryFilterLabel}
            aria-expanded={categoryFilterMenuOpen}
            aria-haspopup='listbox'
          >
            <SlidersHorizontal size={17} aria-hidden />
          </button>
          {categoryFilterMenuOpen ? (
            <ul
              className='urv-filter-menu urv-filter-menu--categories'
              role='listbox'
              aria-label='Filter by record type'
              style={filterMenuStyle}
            >
              {MEDICAL_RECORD_VIEW_FILTERS.map((filter) => (
                <li key={filter.id}>
                  <button
                    type='button'
                    role='option'
                    aria-selected={categoryFilter === filter.id}
                    aria-pressed={categoryFilter === filter.id}
                    onClick={() => {
                      setCategoryFilter(filter.id);
                      setCategoryFilterMenuOpen(false);
                    }}
                  >
                    {filter.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <p className='urv-empty'>No files match your search or filter.</p>
      ) : (
        <ul className='urv-file-list'>
          {filteredRecords.map((record) => {
            const fileIcon = record.external_url ? 'doc' : recordFileIconType(record.file_name);
            const category = recordCategoryId(record);

            return (
              <li key={record.id} className='urv-file-item'>
                <RecordFileTypeIcon type={fileIcon} size='lg' className='urv-file-item__type-icon' />
                <div className='urv-file-item__main'>
                  <p className='urv-file-item__name'>{record.file_name}</p>
                  <p className='urv-file-item__meta'>
                    <span className='urv-file-item__category'>{medicalRecordCategoryLabel(category)}</span>
                    <span>
                      {record.external_url
                        ? 'Google Drive link'
                        : formatFileSize(record.file_size_bytes) +
                          ' • Uploaded ' +
                          relativeUploadLabel(record.uploaded_at)}
                    </span>
                  </p>
                </div>
                <div className='urv-file-item__menu-wrap'>
                  <button
                    type='button'
                    className='urv-file-item__menu-btn'
                    onClick={() => setOpenMenuId((id) => (id === record.id ? null : record.id))}
                    aria-label={'Actions for ' + record.file_name}
                    aria-expanded={openMenuId === record.id}
                    aria-haspopup='menu'
                  >
                    <MoreVertical size={18} aria-hidden />
                  </button>
                  {openMenuId === record.id ? (
                    <ul className='urv-file-item__menu' role='menu'>
                      <li>
                        <button type='button' role='menuitem' onClick={() => void onOpenFile(record)}>
                          {record.external_url ? 'Open link' : 'Open'}
                        </button>
                      </li>
                      <li>
                        <button
                          type='button'
                          role='menuitem'
                          className='danger'
                          onClick={() => requestDelete(record)}
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
      )}
    </section>
  );

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

        {statusMessage ? (
          <p
            className={joinClasses('urv-alert', statusIsError ? 'urv-alert--error' : 'urv-alert--success')}
            role='status'
          >
            {statusMessage}
          </p>
        ) : null}

        {showProceedToRequest ? (
          <section className='urv-pending-request-banner' aria-labelledby='urv-pending-request-heading'>
            <div className='urv-pending-request-banner__content'>
              <h3 id='urv-pending-request-heading' className='urv-pending-request-banner__title'>
                Records ready
              </h3>
              <p className='urv-pending-request-banner__text'>
                Your medical records are uploaded. Continue with your doctor consultation request.
              </p>
            </div>
            <button type='button' className='primary-btn urv-pending-request-banner__btn' onClick={handleProceedToRequest}>
              Proceed to my request
              <ChevronRight size={18} aria-hidden />
            </button>
          </section>
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

        {!loading && !error && showTabs ? (
          <div className='urv-tabs' role='tablist' aria-label='Medical records vault'>
            <button
              type='button'
              role='tab'
              id='urv-tab-view'
              aria-selected={activeTab === 'view'}
              aria-controls='urv-panel-view'
              className={joinClasses('urv-tab', activeTab === 'view' && 'urv-tab--active')}
              onClick={() => setActiveTab('view')}
            >
              View records
            </button>
            <button
              type='button'
              role='tab'
              id='urv-tab-upload'
              aria-selected={activeTab === 'upload'}
              aria-controls='urv-panel-upload'
              className={joinClasses('urv-tab', activeTab === 'upload' && 'urv-tab--active')}
              onClick={() => setActiveTab('upload')}
            >
              Upload records
            </button>
          </div>
        ) : null}

        {!loading && !error && userId ? (
          <>
            {showTabs ? (
              <>
                <div
                  id='urv-panel-view'
                  role='tabpanel'
                  aria-labelledby='urv-tab-view'
                  hidden={activeTab !== 'view'}
                  className='urv-tab-panel'
                >
                  {activeTab === 'view' ? renderViewPanel() : null}
                </div>
                <div
                  id='urv-panel-upload'
                  role='tabpanel'
                  aria-labelledby='urv-tab-upload'
                  hidden={activeTab !== 'upload'}
                  className='urv-tab-panel'
                >
                  {activeTab === 'upload' ? renderUploadPanel() : null}
                </div>
              </>
            ) : (
              renderUploadPanel()
            )}
          </>
        ) : null}

        {!loading && !error && !userId ? (
          <p className='urv-empty'>No records yet. Sign in to upload files.</p>
        ) : null}

        {summaries.length > 0 && activeTab === 'view' && showTabs ? (
          <section className='urv-summaries' aria-labelledby='urv-summaries-heading'>
            <h2 id='urv-summaries-heading' className='urv-summaries__title'>
              Consultation summaries
            </h2>
            <p className='urv-summaries__sub'>
              Structured notes and prescriptions from completed consultations
            </p>
            <ul className='urv-summary-list'>
              {summaries.map((summary) => {
                const hasPrescription = Boolean(summary.prescription?.trim());
                const hasLabOrder = Boolean(summary.labs_diagnostics?.trim());
                const consultationDate = summary.scheduled_at ?? summary.created_at;
                const doctorLabel = summary.doctor_name?.trim() || 'Consultation';
                return (
                  <li key={summary.id} className='urv-summary-item'>
                    <strong>{doctorLabel}</strong>
                    <span>
                      {hasPrescription && hasLabOrder
                        ? 'Prescription and lab order'
                        : hasPrescription
                          ? 'Prescription'
                          : hasLabOrder
                            ? 'Lab order'
                            : summary.assessment_plan ?? summary.chief_complaint ?? ''}
                    </span>
                    <span>{new Date(consultationDate).toLocaleDateString()}</span>
                    {hasPrescription || hasLabOrder ? (
                      <div className='urv-summary-actions'>
                        {hasPrescription ? (
                          <button
                            type='button'
                            className='secondary-btn urv-summary-action-btn'
                            onClick={() => void downloadOrder(summary, 'prescription')}
                            disabled={downloadingOrderKey === `${summary.id}:prescription`}
                          >
                            <Download size={14} aria-hidden />
                            {downloadingOrderKey === `${summary.id}:prescription`
                              ? 'Preparing…'
                              : 'Prescription'}
                          </button>
                        ) : null}
                        {hasLabOrder ? (
                          <button
                            type='button'
                            className='secondary-btn urv-summary-action-btn'
                            onClick={() => void downloadOrder(summary, 'lab')}
                            disabled={downloadingOrderKey === `${summary.id}:lab`}
                          >
                            <Download size={14} aria-hidden />
                            {downloadingOrderKey === `${summary.id}:lab`
                              ? 'Preparing…'
                              : 'Lab Order'}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>

      {recordPendingDelete ? (
        <div className='elixhealth-modal-root urv-delete-confirm-root' role='presentation'>
          <button
            type='button'
            className='elixhealth-modal-backdrop'
            onClick={cancelDelete}
            aria-label='Cancel delete'
            disabled={deletingRecord}
          />
          <div
            className='elixhealth-modal urv-delete-confirm-modal'
            role='alertdialog'
            aria-modal='true'
            aria-labelledby='urv-delete-confirm-title'
            aria-describedby='urv-delete-confirm-desc'
            onClick={(event) => event.stopPropagation()}
          >
            <div className='elixhealth-modal-head'>
              <div>
                <h2 id='urv-delete-confirm-title'>Delete record?</h2>
                <p id='urv-delete-confirm-desc' className='muted'>
                  Do you want to delete{' '}
                  <span className='urv-delete-confirm-modal__name'>{recordPendingDelete.file_name}</span>? This
                  record cannot be retrieved.
                </p>
              </div>
            </div>
            <div className='elixhealth-modal-footer'>
              <button
                type='button'
                className='secondary-btn'
                onClick={cancelDelete}
                disabled={deletingRecord}
              >
                Cancel
              </button>
              <button
                type='button'
                className='urv-delete-confirm-modal__delete-btn'
                onClick={() => void confirmDelete()}
                disabled={deletingRecord}
              >
                {deletingRecord ? (
                  <>
                    <Loader2 size={16} className='spin' aria-hidden />
                    Deleting…
                  </>
                ) : (
                  'Delete record'
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

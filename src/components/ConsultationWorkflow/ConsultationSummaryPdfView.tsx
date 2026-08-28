import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { useMediaQuery } from '@mantine/hooks';
import {
  consultationSummaryPdfMetaFromRequest,
  generateConsultationSummaryPdfBlob,
  downloadConsultationSummaryPdf,
  getConsultationSummarySections
} from '../../lib/consultationSummaryPdf';
import {
  downloadLabOrderPdf,
  downloadPrescriptionOrderPdf,
  generateLabOrderPdfBlob,
  generatePrescriptionOrderPdfBlob
} from '../../lib/consultationOrdersPdf';
import ImageLightboxGallery, { type LightboxImageItem } from '../common/ImageLightboxGallery';
import { fetchDoctorById } from '../../lib/doctors';
import { isImageFileName } from '../../lib/imageFiles';
import { resolvePdfClinicContext } from '../../lib/pdfBranding';
import { getMedicalRecordDownloadUrl } from '../../lib/records';
import { fetchLatestConsultationOrderFile } from '../../lib/r2Storage';
import { normalizeStorageAuthError } from '../../lib/supabaseSession';
import type { Doctor } from '../../types/doctor';
import type { ConsultationSummary, OpinionRequest } from '../../types/opinionRequest';
import './consultation-wizard.css';

type ConsultationSummaryPdfViewProps = {
  summary: ConsultationSummary;
  request: OpinionRequest;
};

type DocKind = 'summary' | 'prescription' | 'lab';

type DocPreviewState = {
  url: string | null;
  loading: boolean;
  error: string | null;
  isPdf: boolean;
  isImage: boolean;
};

type OrderUploadFallback = {
  path: string | null;
  fileName: string | null;
};

function hasHonorificPrefix(name: string): boolean {
  return /^(dr|mr|mrs|ms|miss)\.?\s+/i.test(name.trim());
}

function withDoctorHonorific(name: string | null): string | null {
  if (!name) return null;
  if (hasHonorificPrefix(name)) return name;
  return `Dr. ${name}`;
}

function withPatientHonorific(name: string | null, gender?: string | null): string | null {
  if (!name) return null;
  if (hasHonorificPrefix(name)) return name;
  const normalized = (gender ?? '').trim().toLowerCase();
  if (normalized === 'male') return `Mr. ${name}`;
  if (normalized === 'female') return `Ms. ${name}`;
  return name;
}

function emptyPreview(): DocPreviewState {
  return { url: null, loading: false, error: null, isPdf: true, isImage: false };
}

function fileKindFromName(fileName: string, storagePath?: string): Pick<DocPreviewState, 'isPdf' | 'isImage'> {
  const lower = fileName.toLowerCase();
  const path = storagePath?.toLowerCase() ?? '';
  if (isImageFileName(fileName) || isImageFileName(path)) {
    return { isPdf: false, isImage: true };
  }
  if (lower.endsWith('.pdf') || path.endsWith('.pdf') || path.startsWith('consultation-summaries/')) {
    return { isPdf: true, isImage: false };
  }
  return { isPdf: false, isImage: false };
}

function isUploadedFilePlaceholder(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^\[uploaded file:\s*.+\]$/i.test(value.trim());
}

function uploadedFileNameFromPlaceholder(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(/^\[uploaded file:\s*(.+)\]$/i);
  return match?.[1]?.trim() || null;
}

function resolveOrderUploadFallback(
  request: OpinionRequest,
  recordCategory: 'prescriptions' | 'lab_results',
  preferredName?: string | null
): OrderUploadFallback {
  const records = request.records ?? [];
  if (!records.length) return { path: null, fileName: null };

  const isPrescriptionCategory = recordCategory === 'prescriptions';
  const categoryKeywords = isPrescriptionCategory
    ? ['prescription', 'prescriptions']
    : ['lab_order', 'lab-order', 'lab order', 'lab_results', 'lab-results', 'lab results'];

  const byCategory = records.filter((record) => {
    const path = record.storage_path?.toLowerCase() ?? '';
    const summary = record.summary?.toLowerCase() ?? '';
    if (!path && !summary) return false;
    if (path.includes(`/consultation-orders/${request.id}/${recordCategory}/`)) return true;
    if (path.includes(`/consultation-orders/${request.id}/`) && categoryKeywords.some((k) => path.includes(k))) {
      return true;
    }
    return categoryKeywords.some((k) => summary.includes(k));
  });
  if (!byCategory.length) return { path: null, fileName: null };

  const preferred = preferredName?.trim().toLowerCase();
  const exact = preferred
    ? byCategory.find((record) => record.file_name?.trim().toLowerCase() === preferred)
    : null;
  const pick = exact ?? byCategory[byCategory.length - 1]!;

  return {
    path: pick.storage_path?.trim() || null,
    fileName: pick.file_name?.trim() || null
  };
}

export default function ConsultationSummaryPdfView({
  summary,
  request
}: ConsultationSummaryPdfViewProps) {
  const isCompactViewport = useMediaQuery('(max-width: 1024px)');
  const [summaryPreview, setSummaryPreview] = useState<DocPreviewState>(emptyPreview);
  const [prescriptionPreview, setPrescriptionPreview] =
    useState<DocPreviewState>(emptyPreview);
  const [labPreview, setLabPreview] = useState<DocPreviewState>(emptyPreview);
  const [summaryDownloading, setSummaryDownloading] = useState(false);
  const [prescriptionDownloading, setPrescriptionDownloading] = useState(false);
  const [labOrderDownloading, setLabOrderDownloading] = useState(false);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [clinicId, setClinicId] = useState<string | null>(request.clinic_id?.trim() || null);
  const [clinicName, setClinicName] = useState<string | null>(request.clinic_name ?? null);
  const [clinicReady, setClinicReady] = useState(false);

  const summaryUrlRef = useRef<string | null>(null);
  const prescriptionUrlRef = useRef<string | null>(null);
  const labUrlRef = useRef<string | null>(null);

  const sections = getConsultationSummarySections(summary);
  const storedPath = summary.pdf_storage_path?.trim() ?? '';
  const storedFileName = storedPath.split('/').pop() ?? 'consultation-notes';
  const hasClinicalSummary =
    sections.length > 0 || Boolean(storedPath);
  const prescriptionPlaceholderName = uploadedFileNameFromPlaceholder(summary.prescription);
  const labPlaceholderName = uploadedFileNameFromPlaceholder(summary.labs_diagnostics);
  const hasPrescriptionPlaceholder = isUploadedFilePlaceholder(summary.prescription);
  const hasLabOrderPlaceholder = isUploadedFilePlaceholder(summary.labs_diagnostics);
  const prescriptionFallback = resolveOrderUploadFallback(
    request,
    'prescriptions',
    prescriptionPlaceholderName ?? summary.prescription_file_name
  );
  const labFallback = resolveOrderUploadFallback(
    request,
    'lab_results',
    labPlaceholderName ?? summary.lab_order_file_name
  );
  const prescriptionStoragePath =
    summary.prescription_file_path?.trim() || prescriptionFallback.path || '';
  const labStoragePath = summary.lab_order_file_path?.trim() || labFallback.path || '';
  const prescriptionDisplayFileName =
    summary.prescription_file_name?.trim() ||
    prescriptionFallback.fileName ||
    prescriptionPlaceholderName;
  const labDisplayFileName =
    summary.lab_order_file_name?.trim() || labFallback.fileName || labPlaceholderName;
  const hasPrescriptionOrder = Boolean(
    summary.prescription_file_path?.trim() ||
      prescriptionFallback.path ||
      (!hasPrescriptionPlaceholder && summary.prescription?.trim()) ||
      prescriptionPlaceholderName
  );
  const hasLabOrder = Boolean(
    summary.lab_order_file_path?.trim() ||
      labFallback.path ||
      (!hasLabOrderPlaceholder && summary.labs_diagnostics?.trim()) ||
      labPlaceholderName
  );

  const resolveOrderUploadPathCandidates = async (
    category: 'prescriptions' | 'lab_results',
    currentPaths: Array<string | null | undefined>,
    currentFileName: string | null | undefined
  ): Promise<{ paths: string[]; fileName: string | null }> => {
    const trimmedCurrent = currentPaths
      .map((value) => value?.trim() || '')
      .filter(Boolean);
    const latest = await fetchLatestConsultationOrderFile(request.id, category);
    const latestPath = latest.data?.storagePath?.trim() || '';

    const unique = new Set<string>();
    for (const path of [...trimmedCurrent, latestPath]) {
      if (!path) continue;
      unique.add(path);
    }

    return {
      paths: [...unique],
      fileName: latest.data?.fileName?.trim() || currentFileName?.trim() || null
    };
  };

  const getDownloadUrlForPath = async (storagePath: string) => {
    // Primary path: scoped to request for stricter access checks.
    const scoped = await getMedicalRecordDownloadUrl(storagePath, {
      requestId: request.id
    });
    if (scoped.data?.signedUrl && !scoped.error) return scoped;

    // Fallback: some consultation order records are resolvable from vault context
    // even when request-scoped lookup fails.
    const unscoped = await getMedicalRecordDownloadUrl(storagePath);
    if (unscoped.data?.signedUrl && !unscoped.error) return unscoped;

    return scoped.error ? scoped : unscoped;
  };

  const resolveFirstAccessibleOrderFile = async (
    category: 'prescriptions' | 'lab_results',
    candidatePaths: Array<string | null | undefined>,
    currentFileName: string | null | undefined
  ): Promise<{ path: string | null; fileName: string | null; url: string | null; errorMessage: string | null }> => {
    const resolved = await resolveOrderUploadPathCandidates(category, candidatePaths, currentFileName);
    let lastErrorMessage: string | null = null;

    for (const path of resolved.paths) {
      const { data, error } = await getDownloadUrlForPath(path);
      if (data?.signedUrl && !error) {
        return {
          path,
          fileName: resolved.fileName || path.split('/').pop() || null,
          url: data.signedUrl,
          errorMessage: null
        };
      }
      lastErrorMessage = normalizeStorageAuthError(error?.message ?? 'Could not load order file.');
    }

    return {
      path: null,
      fileName: resolved.fileName,
      url: null,
      errorMessage: lastErrorMessage
    };
  };
  const patientDisplayName = withPatientHonorific(request.patient_name, request.patient_gender);
  const doctorDisplayName = withDoctorHonorific(request.doctor_name);
  const doctorId =
    request.doctor_id?.trim() ||
    request.selected_doctor_id?.trim() ||
    summary.doctor_id?.trim() ||
    null;

  const revokeUrl = (ref: { current: string | null }) => {
    if (ref.current?.startsWith('blob:')) {
      URL.revokeObjectURL(ref.current);
    }
    ref.current = null;
  };

  const setPreviewUrl = (
    ref: { current: string | null },
    setter: (state: DocPreviewState | ((prev: DocPreviewState) => DocPreviewState)) => void,
    url: string | null,
    kind: Pick<DocPreviewState, 'isPdf' | 'isImage'>
  ) => {
    revokeUrl(ref);
    ref.current = url;
    setter((prev) => ({
      ...prev,
      url,
      loading: false,
      error: null,
      isPdf: kind.isPdf,
      isImage: kind.isImage
    }));
  };

  useEffect(() => {
    if (!doctorId) {
      setDoctor(null);
      return;
    }
    let cancelled = false;
    void fetchDoctorById(doctorId).then(({ data }) => {
      if (!cancelled) setDoctor(data ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [doctorId]);

  useEffect(() => {
    let cancelled = false;
    setClinicReady(false);
    void resolvePdfClinicContext({
      clinicId: request.clinic_id,
      clinicName: request.clinic_name,
      doctor,
      patientId: request.patient_id
    }).then((clinic) => {
      if (cancelled) return;
      setClinicId(clinic.clinicId);
      setClinicName(clinic.clinicName);
      setClinicReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [request.clinic_id, request.clinic_name, request.patient_id, doctor]);

  const meta = consultationSummaryPdfMetaFromRequest(
    { ...request, clinic_id: clinicId, clinic_name: clinicName },
    doctor
  );
  const orderMeta = {
    patientName: request.patient_name,
    patientGender: request.patient_gender,
    patientEmail: request.patient_email,
    patientId: request.patient_id,
    doctorName: doctor?.full_name ?? request.doctor_name ?? summary.doctor_name,
    doctorSpecialty: doctor?.specialty ?? request.doctor_specialty ?? summary.doctor_specialty,
    doctorQualification: doctor?.qualification ?? summary.doctor_qualification,
    doctorMedicalLicenseNo: doctor?.medical_license_no ?? summary.doctor_medical_license_no,
    doctor,
    scheduledAt: request.scheduled_at ?? summary.scheduled_at,
    requestId: request.id,
    clinicId,
    clinicName,
    issuedAt: new Date(summary.updated_at || summary.created_at)
  };

  // Consultation summary PDF
  useEffect(() => {
    if (!hasClinicalSummary) {
      revokeUrl(summaryUrlRef);
      setSummaryPreview(emptyPreview());
      return;
    }

    let cancelled = false;

    const load = async () => {
      setSummaryPreview((prev) => ({ ...prev, loading: true, error: null }));

      // Prefer live-generated clinical notes PDF when structured clinical fields exist.
      if (sections.length > 0) {
        if (!clinicReady) return;
        try {
          const blob = await generateConsultationSummaryPdfBlob(summary, meta);
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          setPreviewUrl(summaryUrlRef, setSummaryPreview, url, { isPdf: true, isImage: false });
        } catch (err) {
          if (cancelled) return;
          setSummaryPreview({
            url: null,
            loading: false,
            error:
              err instanceof Error ? err.message : 'Could not generate consultation notes PDF.',
            isPdf: true,
            isImage: false
          });
        }
        return;
      }

      // File-only uploaded notes
      if (!storedPath) {
        setSummaryPreview(emptyPreview());
        return;
      }

      const { data, error } = await getDownloadUrlForPath(storedPath);
      if (cancelled) return;
      if (error || !data?.signedUrl) {
        setSummaryPreview({
          url: null,
          loading: false,
          error: normalizeStorageAuthError(
            error?.message ?? 'Could not load consultation notes file.'
          ),
          isPdf: true,
          isImage: false
        });
        return;
      }
      revokeUrl(summaryUrlRef);
      summaryUrlRef.current = data.signedUrl;
      const kind = fileKindFromName(storedFileName, storedPath);
      setSummaryPreview({
        url: data.signedUrl,
        loading: false,
        error: null,
        ...kind
      });
    };

    void load();
    return () => {
      cancelled = true;
    };
    // meta/orderMeta are rebuilt each render; depend on stable clinic + summary fields
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional deps
  }, [
    hasClinicalSummary,
    sections.length,
    storedPath,
    storedFileName,
    request.id,
    summary,
    clinicReady,
    clinicId,
    clinicName,
    doctor?.id
  ]);

  // Prescription PDF
  useEffect(() => {
    if (!hasPrescriptionOrder) {
      revokeUrl(prescriptionUrlRef);
      setPrescriptionPreview(emptyPreview());
      return;
    }

    let cancelled = false;
    const load = async () => {
      setPrescriptionPreview((prev) => ({ ...prev, loading: true, error: null }));

      // Prefer the doctor-uploaded file when present (text + upload are both collected).
      const resolved = await resolveFirstAccessibleOrderFile(
        'prescriptions',
        [summary.prescription_file_path, prescriptionFallback.path, prescriptionStoragePath],
        prescriptionDisplayFileName
      );
      if (resolved.path && resolved.url) {
        if (cancelled) return;
        revokeUrl(prescriptionUrlRef);
        prescriptionUrlRef.current = resolved.url;
        const fileName = resolved.fileName || resolved.path.split('/').pop() || '';
        setPrescriptionPreview({
          url: resolved.url,
          loading: false,
          error: null,
          ...fileKindFromName(fileName)
        });
        return;
      }

      const typed = summary.prescription?.trim();
      if (typed && !isUploadedFilePlaceholder(typed)) {
        if (!clinicReady) return;
        try {
          const blob = await generatePrescriptionOrderPdfBlob(typed, orderMeta);
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          setPreviewUrl(prescriptionUrlRef, setPrescriptionPreview, url, {
            isPdf: true,
            isImage: false
          });
        } catch (err) {
          if (cancelled) return;
          setPrescriptionPreview({
            url: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Could not generate prescription PDF.',
            isPdf: true,
            isImage: false
          });
        }
        return;
      }

      if (!cancelled) {
        if (typed && isUploadedFilePlaceholder(typed)) {
          setPrescriptionPreview({
            url: null,
            loading: false,
            error:
              resolved.errorMessage || 'Uploaded prescription file was not found for this consultation.',
            isPdf: true,
            isImage: false
          });
          return;
        }
        setPrescriptionPreview(emptyPreview());
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional deps
  }, [
    hasPrescriptionOrder,
    summary.prescription,
    summary.prescription_file_path,
    summary.prescription_file_name,
    request.records,
    request.id,
    prescriptionStoragePath,
    prescriptionDisplayFileName,
    clinicReady,
    clinicId,
    clinicName,
    doctor?.id
  ]);

  // Lab order PDF
  useEffect(() => {
    if (!hasLabOrder) {
      revokeUrl(labUrlRef);
      setLabPreview(emptyPreview());
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLabPreview((prev) => ({ ...prev, loading: true, error: null }));

      // Prefer the doctor-uploaded file when present (text + upload are both collected).
      const resolved = await resolveFirstAccessibleOrderFile(
        'lab_results',
        [summary.lab_order_file_path, labFallback.path, labStoragePath],
        labDisplayFileName
      );
      if (resolved.path && resolved.url) {
        if (cancelled) return;
        revokeUrl(labUrlRef);
        labUrlRef.current = resolved.url;
        const fileName = resolved.fileName || resolved.path.split('/').pop() || '';
        setLabPreview({
          url: resolved.url,
          loading: false,
          error: null,
          ...fileKindFromName(fileName)
        });
        return;
      }

      const typed = summary.labs_diagnostics?.trim();
      if (typed && !isUploadedFilePlaceholder(typed)) {
        if (!clinicReady) return;
        try {
          const blob = await generateLabOrderPdfBlob(typed, orderMeta);
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          setPreviewUrl(labUrlRef, setLabPreview, url, { isPdf: true, isImage: false });
        } catch (err) {
          if (cancelled) return;
          setLabPreview({
            url: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Could not generate lab order PDF.',
            isPdf: true,
            isImage: false
          });
        }
        return;
      }

      if (!cancelled) {
        if (typed && isUploadedFilePlaceholder(typed)) {
          setLabPreview({
            url: null,
            loading: false,
            error: resolved.errorMessage || 'Uploaded lab order file was not found for this consultation.',
            isPdf: true,
            isImage: false
          });
          return;
        }
        setLabPreview(emptyPreview());
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional deps
  }, [
    hasLabOrder,
    summary.labs_diagnostics,
    summary.lab_order_file_path,
    summary.lab_order_file_name,
    request.records,
    request.id,
    labStoragePath,
    labDisplayFileName,
    clinicReady,
    clinicId,
    clinicName,
    doctor?.id
  ]);

  useEffect(() => {
    return () => {
      revokeUrl(summaryUrlRef);
      revokeUrl(prescriptionUrlRef);
      revokeUrl(labUrlRef);
    };
  }, []);

  const downloadStoredOrderFile = async (
    storagePath: string,
    fileName: string | null | undefined,
    fallbackName: string
  ) => {
    const { data, error } = await getDownloadUrlForPath(storagePath);
    if (error || !data?.signedUrl) {
      throw new Error(
        normalizeStorageAuthError(error?.message ?? 'Could not download order file.')
      );
    }
    const anchor = document.createElement('a');
    anchor.href = data.signedUrl;
    anchor.download = fileName?.trim() || fallbackName;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(data.signedUrl), 60_000);
  };

  const handleSummaryDownload = async () => {
    setSummaryDownloading(true);
    try {
      if (sections.length > 0) {
        await downloadConsultationSummaryPdf(summary, meta);
        return;
      }
      if (storedPath && summaryPreview.url) {
        const anchor = document.createElement('a');
        anchor.href = summaryPreview.url;
        anchor.download =
          storedFileName || `consultation-summary-${request.patient_name ?? request.id}`;
        anchor.click();
        return;
      }
      await downloadConsultationSummaryPdf(summary, meta);
    } finally {
      setSummaryDownloading(false);
    }
  };

  const handlePrescriptionDownload = async () => {
    setPrescriptionDownloading(true);
    try {
      const resolved = await resolveFirstAccessibleOrderFile(
        'prescriptions',
        [summary.prescription_file_path, prescriptionFallback.path, prescriptionStoragePath],
        prescriptionDisplayFileName
      );
      if (resolved.path) {
        await downloadStoredOrderFile(
          resolved.path,
          resolved.fileName ?? prescriptionDisplayFileName,
          'Prescription'
        );
        return;
      }
      const typed = summary.prescription?.trim();
      if (typed && !isUploadedFilePlaceholder(typed)) {
        await downloadPrescriptionOrderPdf(typed, orderMeta);
      }
    } catch (err) {
      setPrescriptionPreview((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Could not download prescription.'
      }));
    } finally {
      setPrescriptionDownloading(false);
    }
  };

  const handleLabOrderDownload = async () => {
    setLabOrderDownloading(true);
    try {
      const resolved = await resolveFirstAccessibleOrderFile(
        'lab_results',
        [summary.lab_order_file_path, labFallback.path, labStoragePath],
        labDisplayFileName
      );
      if (resolved.path) {
        await downloadStoredOrderFile(
          resolved.path,
          resolved.fileName ?? labDisplayFileName,
          'Lab-Order'
        );
        return;
      }
      const typed = summary.labs_diagnostics?.trim();
      if (typed && !isUploadedFilePlaceholder(typed)) {
        await downloadLabOrderPdf(typed, orderMeta);
      }
    } catch (err) {
      setLabPreview((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Could not download lab order.'
      }));
    } finally {
      setLabOrderDownloading(false);
    }
  };

  const renderSummaryHtml = () => (
    <div className='consultation-summary-pdf__page' aria-label='Consultation summary'>
      <header className='consultation-summary-pdf__header'>
        <p className='consultation-summary-pdf__brand'>ElixClinix</p>
        <h5 className='consultation-summary-pdf__title'>Consultation Summary</h5>
        {patientDisplayName ? (
          <p className='consultation-summary-pdf__meta'>Patient: {patientDisplayName}</p>
        ) : null}
        {doctorDisplayName ? (
          <p className='consultation-summary-pdf__meta'>
            Doctor: {doctorDisplayName}
            {request.doctor_specialty ? ` · ${request.doctor_specialty}` : ''}
          </p>
        ) : null}
        {request.scheduled_at ? (
          <p className='consultation-summary-pdf__meta'>
            Consultation: {new Date(request.scheduled_at).toLocaleString()}
          </p>
        ) : null}
      </header>

      {sections.map((section) => (
        <section key={section.label} className='consultation-summary-pdf__section'>
          <h6>{section.label}</h6>
          <p>{section.value}</p>
        </section>
      ))}
    </div>
  );

  const renderDocument = (opts: {
    kind: DocKind;
    title: string;
    preview: DocPreviewState;
    downloading: boolean;
    onDownload: () => void;
    emptyMessage: string;
    visible: boolean;
  }) => {
    if (!opts.visible) return null;
    const { preview, title } = opts;
    const imageItems: LightboxImageItem[] =
      preview.url && preview.isImage
        ? [
            {
              id: `${opts.kind}-upload`,
              src: preview.url,
              alt: `${title} uploaded image`,
              caption: title
            }
          ]
        : [];
    const showHtmlSummary = opts.kind === 'summary' && sections.length > 0 && Boolean(isCompactViewport);
    return (
      <section className='consultation-summary-pdf__doc' aria-label={title}>
        <div className='consultation-summary-pdf__toolbar'>
          <span className='consultation-summary-pdf__toolbar-label'>
            <FileText size={18} aria-hidden />
            {title}
          </span>
          <div className='consultation-summary-pdf__toolbar-actions'>
            {preview.url ? (
              <button
                type='button'
                className='secondary-btn consultation-summary-pdf__download'
                onClick={() => window.open(preview.url!, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink size={16} aria-hidden />
                {preview.isImage ? 'Open image' : preview.isPdf ? 'View file' : 'Open file'}
              </button>
            ) : null}
            <button
              type='button'
              className='secondary-btn consultation-summary-pdf__download'
              disabled={opts.downloading || preview.loading}
              onClick={() => void opts.onDownload()}
            >
              <Download size={16} aria-hidden />
              {opts.downloading ? 'Preparing…' : 'Download'}
            </button>
          </div>
        </div>

        <div className='consultation-summary-pdf__viewer' aria-label={`${title} preview`}>
          {preview.loading && !showHtmlSummary ? (
            <p className='muted consultation-summary-pdf__viewer-status'>
              <Loader2 size={16} className='spin' aria-hidden /> Preparing file…
            </p>
          ) : null}
          {preview.error && !showHtmlSummary ? (
            <p className='auth-error consultation-summary-pdf__viewer-status' role='alert'>
              {preview.error}
            </p>
          ) : null}
          {showHtmlSummary ? renderSummaryHtml() : null}
          {!showHtmlSummary && preview.url && preview.isPdf ? (
            <iframe
              className='consultation-summary-pdf__iframe'
              src={preview.url}
              title={title}
            />
          ) : null}
          {!showHtmlSummary && preview.url && !preview.isPdf && preview.isImage ? (
            <div className='consultation-summary-pdf__lightbox'>
              <ImageLightboxGallery images={imageItems} modalZIndex={600} />
            </div>
          ) : null}
          {!showHtmlSummary && preview.url && !preview.isPdf && !preview.isImage ? (
            <p className='muted consultation-summary-pdf__viewer-status'>
              Preview is not available for this file type. Use Open file or Download.
            </p>
          ) : null}
          {!showHtmlSummary && !preview.loading && !preview.error && !preview.url ? (
            <p className='muted consultation-summary-pdf__viewer-status'>{opts.emptyMessage}</p>
          ) : null}
        </div>
      </section>
    );
  };

  return (
    <div className='consultation-summary-pdf consultation-summary-pdf--stack'>
      {renderDocument({
        kind: 'summary',
        title: 'Consultation summary (PDF)',
        preview: summaryPreview,
        downloading: summaryDownloading,
        onDownload: handleSummaryDownload,
        emptyMessage: 'Consultation summary PDF will appear here when available.',
        visible: hasClinicalSummary || (!hasPrescriptionOrder && !hasLabOrder)
      })}

      {renderDocument({
        kind: 'prescription',
        title: 'Prescription',
        preview: prescriptionPreview,
        downloading: prescriptionDownloading,
        onDownload: handlePrescriptionDownload,
        emptyMessage: 'Prescription will appear here when available.',
        visible: hasPrescriptionOrder
      })}

      {renderDocument({
        kind: 'lab',
        title: 'Lab Order',
        preview: labPreview,
        downloading: labOrderDownloading,
        onDownload: handleLabOrderDownload,
        emptyMessage: 'Lab order will appear here when available.',
        visible: hasLabOrder
      })}

      {/* Text fallback when summary generation fails */}
      {!summaryPreview.url &&
      !summaryPreview.loading &&
      sections.length > 0 &&
      summaryPreview.error &&
      !isCompactViewport ? (
        renderSummaryHtml()
      ) : null}
    </div>
  );
}

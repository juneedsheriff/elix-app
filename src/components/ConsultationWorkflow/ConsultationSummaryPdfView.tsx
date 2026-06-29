import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, FileText, Loader2 } from 'lucide-react';
import {
  consultationSummaryPdfMetaFromRequest,
  downloadConsultationSummaryPdf,
  getConsultationSummarySections
} from '../../lib/consultationSummaryPdf';
import {
  downloadLabOrderPdf,
  downloadPrescriptionOrderPdf
} from '../../lib/consultationOrdersPdf';
import { isImageFileName } from '../../lib/imageFiles';
import { getMedicalRecordDownloadUrl } from '../../lib/records';
import { normalizeStorageAuthError } from '../../lib/supabaseSession';
import type { ConsultationSummary, OpinionRequest } from '../../types/opinionRequest';
import './consultation-wizard.css';

type ConsultationSummaryPdfViewProps = {
  summary: ConsultationSummary;
  request: OpinionRequest;
};

export default function ConsultationSummaryPdfView({ summary, request }: ConsultationSummaryPdfViewProps) {
  const [downloading, setDownloading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [prescriptionDownloading, setPrescriptionDownloading] = useState(false);
  const [labOrderDownloading, setLabOrderDownloading] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const sections = getConsultationSummarySections(summary);
  const storedPath = summary.pdf_storage_path?.trim() ?? '';
  const hasStoredPdf = Boolean(storedPath);
  const storedFileName = storedPath.split('/').pop() ?? 'consultation-notes';
  const storedIsPdf = storedFileName.toLowerCase().endsWith('.pdf');
  const storedIsImage = isImageFileName(storedFileName);
  const hasStructuredPreview = sections.length > 0;
  const hasPrescriptionOrder = Boolean(summary.prescription?.trim());
  const hasLabOrder = Boolean(summary.labs_diagnostics?.trim());

  useEffect(() => {
    if (!storedPath) {
      setPdfUrl(null);
      setPdfError(null);
      setPdfLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setPdfLoading(true);
      setPdfError(null);
      const { data, error } = await getMedicalRecordDownloadUrl(storedPath, { requestId: request.id });
      if (cancelled) return;
      if (error || !data?.signedUrl) {
        setPdfUrl(null);
        setPdfError(normalizeStorageAuthError(error?.message ?? 'Could not load consultation notes file.'));
        setPdfLoading(false);
        return;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      objectUrlRef.current = data.signedUrl;
      setPdfUrl(data.signedUrl);
      setPdfLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [storedPath, request.id]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const meta = consultationSummaryPdfMetaFromRequest(request);
  const orderMeta = {
    patientName: request.patient_name,
    patientId: request.patient_id,
    doctorName: request.doctor_name,
    doctorSpecialty: request.doctor_specialty,
    scheduledAt: request.scheduled_at,
    requestId: request.id,
    issuedAt: new Date(summary.updated_at || summary.created_at)
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (storedPath && pdfUrl) {
        const anchor = document.createElement('a');
        anchor.href = pdfUrl;
        anchor.download = storedFileName || `consultation-summary-${request.patient_name ?? request.id}`;
        anchor.click();
        return;
      }
      await downloadConsultationSummaryPdf(summary, meta);
    } finally {
      setDownloading(false);
    }
  };

  const handleOpenInNewTab = () => {
    if (pdfUrl) window.open(pdfUrl, '_blank', 'noopener,noreferrer');
  };

  const handlePrescriptionDownload = async () => {
    if (!summary.prescription?.trim()) return;
    setPrescriptionDownloading(true);
    try {
      await downloadPrescriptionOrderPdf(summary.prescription, orderMeta);
    } finally {
      setPrescriptionDownloading(false);
    }
  };

  const handleLabOrderDownload = async () => {
    if (!summary.labs_diagnostics?.trim()) return;
    setLabOrderDownloading(true);
    try {
      await downloadLabOrderPdf(summary.labs_diagnostics, orderMeta);
    } finally {
      setLabOrderDownloading(false);
    }
  };

  return (
    <div className='consultation-summary-pdf'>
      <div className='consultation-summary-pdf__toolbar'>
        <span className='consultation-summary-pdf__toolbar-label'>
          <FileText size={18} aria-hidden />
          Consultation notes{storedIsPdf ? ' (PDF)' : ''}
        </span>
        <div className='consultation-summary-pdf__toolbar-actions'>
          {pdfUrl ? (
            <button
              type='button'
              className='secondary-btn consultation-summary-pdf__download'
              onClick={handleOpenInNewTab}
            >
              <ExternalLink size={16} aria-hidden />
              Open file
            </button>
          ) : null}
          <button
            type='button'
            className='secondary-btn consultation-summary-pdf__download'
            disabled={downloading || (hasStoredPdf && pdfLoading)}
            onClick={() => void handleDownload()}
          >
            <Download size={16} aria-hidden />
            {downloading ? 'Preparing…' : 'Download'}
          </button>
        </div>
      </div>

      {hasPrescriptionOrder || hasLabOrder ? (
        <div className='consultation-summary-pdf__toolbar'>
          <span className='consultation-summary-pdf__toolbar-label'>
            <FileText size={18} aria-hidden />
            Patient orders
          </span>
          <div className='consultation-summary-pdf__toolbar-actions'>
            {hasPrescriptionOrder ? (
              <button
                type='button'
                className='secondary-btn consultation-summary-pdf__download'
                disabled={prescriptionDownloading}
                onClick={() => void handlePrescriptionDownload()}
              >
                <Download size={16} aria-hidden />
                {prescriptionDownloading ? 'Preparing…' : 'Prescription'}
              </button>
            ) : null}
            {hasLabOrder ? (
              <button
                type='button'
                className='secondary-btn consultation-summary-pdf__download'
                disabled={labOrderDownloading}
                onClick={() => void handleLabOrderDownload()}
              >
                <Download size={16} aria-hidden />
                {labOrderDownloading ? 'Preparing…' : 'Lab Order'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {hasStoredPdf ? (
        <div className='consultation-summary-pdf__viewer' aria-label='Stored consultation notes file'>
          {pdfLoading ? (
            <p className='muted consultation-summary-pdf__viewer-status'>
              <Loader2 size={16} className='spin' aria-hidden /> Loading file…
            </p>
          ) : null}
          {pdfError ? (
            <p className='auth-error consultation-summary-pdf__viewer-status' role='alert'>
              {pdfError}
            </p>
          ) : null}
          {pdfUrl && storedIsPdf ? (
            <iframe
              className='consultation-summary-pdf__iframe'
              src={pdfUrl}
              title='Consultation summary PDF'
            />
          ) : null}
          {pdfUrl && storedIsImage ? (
            <img
              className='consultation-summary-pdf__image'
              src={pdfUrl}
              alt='Uploaded consultation notes'
            />
          ) : null}
          {pdfUrl && !storedIsPdf && !storedIsImage ? (
            <p className='muted consultation-summary-pdf__viewer-status'>
              Preview is not available for this file type. Use Open file or Download.
            </p>
          ) : null}
        </div>
      ) : null}

      {hasStructuredPreview ? (
        <div className='consultation-summary-pdf__page' aria-label='Consultation summary preview'>
          <header className='consultation-summary-pdf__header'>
            <p className='consultation-summary-pdf__brand'>ElixClinix</p>
            <h5 className='consultation-summary-pdf__title'>Consultation Summary</h5>
            {request.patient_name ? (
              <p className='consultation-summary-pdf__meta'>Patient: {request.patient_name}</p>
            ) : null}
            {request.doctor_name ? (
              <p className='consultation-summary-pdf__meta'>
                Doctor: {request.doctor_name}
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
      ) : null}
    </div>
  );
}

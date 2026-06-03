import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText, Loader2 } from 'lucide-react';
import {
  consultationSummaryPdfMetaFromRequest,
  downloadConsultationSummaryPdf,
  getConsultationSummarySections
} from '../../lib/consultationSummaryPdf';
import { getMedicalRecordDownloadUrl } from '../../lib/records';
import type { ConsultationSummary, OpinionRequest } from '../../types/opinionRequest';

type ConsultationSummaryPdfViewProps = {
  summary: ConsultationSummary;
  request: OpinionRequest;
};

export default function ConsultationSummaryPdfView({ summary, request }: ConsultationSummaryPdfViewProps) {
  const [downloading, setDownloading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const sections = getConsultationSummarySections(summary);
  const storedPath = summary.pdf_storage_path?.trim() ?? '';

  useEffect(() => {
    if (!storedPath) {
      setPdfUrl(null);
      setPdfError(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    const load = async () => {
      setPdfLoading(true);
      setPdfError(null);
      const { data, error } = await getMedicalRecordDownloadUrl(storedPath, { requestId: request.id });
      if (cancelled) return;
      if (error || !data?.signedUrl) {
        setPdfUrl(null);
        setPdfError(error?.message ?? 'Could not load consultation PDF.');
        setPdfLoading(false);
        return;
      }
      objectUrl = data.signedUrl;
      setPdfUrl(data.signedUrl);
      setPdfLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [storedPath, request.id]);

  const meta = consultationSummaryPdfMetaFromRequest(request);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (storedPath && pdfUrl) {
        const anchor = document.createElement('a');
        anchor.href = pdfUrl;
        anchor.download = `consultation-summary-${request.patient_name ?? request.id}.pdf`;
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

  return (
    <div className='consultation-summary-pdf'>
      <div className='consultation-summary-pdf__toolbar'>
        <span className='consultation-summary-pdf__toolbar-label'>
          <FileText size={18} aria-hidden />
          Consultation notes (PDF)
        </span>
        <div className='consultation-summary-pdf__toolbar-actions'>
          {pdfUrl ? (
            <button
              type='button'
              className='secondary-btn consultation-summary-pdf__download'
              onClick={handleOpenInNewTab}
            >
              <ExternalLink size={16} aria-hidden />
              Open PDF
            </button>
          ) : null}
          <button
            type='button'
            className='secondary-btn consultation-summary-pdf__download'
            disabled={downloading}
            onClick={() => void handleDownload()}
          >
            <Download size={16} aria-hidden />
            {downloading ? 'Preparing…' : 'Download '}
          </button>
        </div>
      </div>

      {/* {storedPath ? (
        <div className='consultation-summary-pdf__viewer' aria-label='Stored consultation PDF'>
          {pdfLoading ? (
            <p className='muted consultation-summary-pdf__viewer-status'>
              <Loader2 size={16} className='spin' aria-hidden /> Loading PDF…
            </p>
          ) : null}
          {pdfError ? (
            <p className='auth-error consultation-summary-pdf__viewer-status' role='alert'>
              {pdfError}
            </p>
          ) : null}
          {pdfUrl ? (
            <iframe
              className='consultation-summary-pdf__iframe'
              src={pdfUrl}
              title='Consultation summary PDF'
            />
          ) : null}
        </div>
      ) : null} */}

      {/* <div className='consultation-summary-pdf__page' aria-label='Consultation summary preview'>
        <header className='consultation-summary-pdf__header'>
          <p className='consultation-summary-pdf__brand'>Elix Health</p>
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
      </div> */}
    </div>
  );
}

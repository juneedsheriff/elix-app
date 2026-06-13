import { useEffect, useState } from 'react';
import { ChevronDown, Download, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { formatConsultationFee, normalizeConsultationCurrency } from '../../lib/consultationCurrency';
import { getMedicalRecordDownloadUrl } from '../../lib/records';
import type { OpinionRequest } from '../../types/opinionRequest';

type ConsultationInvoicePdfViewProps = {
  request: OpinionRequest;
  variant?: 'pse' | 'patient';
};

export default function ConsultationInvoicePdfView({
  request,
  variant = 'patient'
}: ConsultationInvoicePdfViewProps) {
  const [expanded, setExpanded] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const storedPath = request.invoice_pdf_storage_path?.trim() ?? '';

  useEffect(() => {
    if (!storedPath) {
      setPdfUrl(null);
      setPdfError(null);
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
        setPdfError(error?.message ?? 'Could not load invoice PDF.');
        setPdfLoading(false);
        return;
      }
      setPdfUrl(data.signedUrl);
      setPdfLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [storedPath, request.id]);

  if (!storedPath) return null;

  const currency = normalizeConsultationCurrency(request.payment_currency ?? request.consultation_currency);
  const totalLabel =
    request.invoice_total != null
      ? formatConsultationFee(Number(request.invoice_total), currency)
      : null;

  const handleDownload = () => {
    if (!pdfUrl) return;
    const anchor = document.createElement('a');
    anchor.href = pdfUrl;
    anchor.download = `consultation-invoice-${request.invoice_number ?? request.id}.pdf`;
    anchor.click();
  };

  const handleOpenInNewTab = () => {
    if (pdfUrl) window.open(pdfUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className={`consultation-invoice-pdf consultation-invoice-pdf--collapsible${
        expanded ? ' consultation-invoice-pdf--expanded' : ''
      }`}
    >
      <div className='consultation-invoice-pdf__header'>
        <button
          type='button'
          className='consultation-invoice-pdf__toggle'
          aria-expanded={expanded}
          aria-controls={`consultation-invoice-panel-${request.id}`}
          onClick={() => setExpanded((current) => !current)}
        >
          <FileText size={18} aria-hidden />
          <span className='consultation-invoice-pdf__toggle-label'>Consultation invoice (PDF)</span>
          <ChevronDown size={18} className='consultation-invoice-pdf__chevron' aria-hidden />
        </button>

        <div className='consultation-invoice-pdf__actions'>
          <button
            type='button'
            className='secondary-btn consultation-invoice-pdf__action'
            disabled={!pdfUrl || pdfLoading}
            onClick={handleOpenInNewTab}
          >
            <ExternalLink size={16} aria-hidden />
            Open PDF
          </button>
          <button
            type='button'
            className='secondary-btn consultation-invoice-pdf__action'
            disabled={!pdfUrl || pdfLoading}
            onClick={handleDownload}
          >
            <Download size={16} aria-hidden />
            Download
          </button>
        </div>
      </div>

      {expanded ? (
        <div
          id={`consultation-invoice-panel-${request.id}`}
          className='consultation-invoice-pdf__panel'
        >
          <div className='consultation-invoice-pdf__meta'>
            {request.invoice_number ? (
              <p className='muted'>
                <strong>{request.invoice_number}</strong>
                {request.invoice_generated_at
                  ? ` · ${new Date(request.invoice_generated_at).toLocaleString()}`
                  : ''}
              </p>
            ) : null}
            {totalLabel ? (
              <p className='muted'>
                Total due: <strong>{totalLabel}</strong>
                {request.invoice_tax_amount != null && Number(request.invoice_tax_amount) > 0
                  ? ` (includes tax ${formatConsultationFee(Number(request.invoice_tax_amount), currency)})`
                  : ''}
              </p>
            ) : null}
            {variant === 'patient' ? (
              <p className='muted'>Review your invoice before completing payment.</p>
            ) : (
              <p className='muted'>Shared with the patient on their Payment step.</p>
            )}
          </div>

          {pdfLoading ? (
            <p className='muted consultation-invoice-pdf__status'>
              <Loader2 size={16} className='spin' aria-hidden /> Loading invoice…
            </p>
          ) : null}
          {pdfError ? (
            <p className='auth-error consultation-invoice-pdf__status' role='alert'>
              {pdfError}
            </p>
          ) : null}
          {pdfUrl ? (
            <iframe
              className='consultation-invoice-pdf__iframe'
              src={pdfUrl}
              title='Consultation invoice PDF'
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

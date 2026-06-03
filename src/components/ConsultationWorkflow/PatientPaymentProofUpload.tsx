import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { getMedicalRecordDownloadUrl } from '../../lib/records';
import { patientSubmitPaymentProof } from '../../lib/opinionRequests';
import type { OpinionRequest } from '../../types/opinionRequest';

type PatientPaymentProofUploadProps = {
  request: OpinionRequest;
  disabled?: boolean;
  onSubmitted?: () => void;
  onMessage?: (text: string, tone: 'success' | 'error') => void;
};

export function hasPatientPaymentProof(request: OpinionRequest): boolean {
  return Boolean(request.payment_proof_submitted_at && request.payment_proof_storage_path);
}

export default function PatientPaymentProofUpload({
  request,
  disabled = false,
  onSubmitted,
  onMessage
}: PatientPaymentProofUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;

    async function loadPreview() {
      if (!request.payment_proof_storage_path) {
        setPreviewUrl(null);
        return;
      }
      const { data, error } = await getMedicalRecordDownloadUrl(request.payment_proof_storage_path, {
        requestId: request.id
      });
      if (cancelled) return;
      if (error || !data?.signedUrl) {
        setPreviewUrl(null);
        return;
      }
      revoke = data.signedUrl;
      setPreviewUrl(data.signedUrl);
    }

    void loadPreview();
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [request.payment_proof_storage_path, request.payment_proof_submitted_at]);

  const handleFile = async (file: File | null) => {
    if (!file || disabled || busy) return;
    setBusy(true);
    const { error } = await patientSubmitPaymentProof(request.id, file);
    setBusy(false);
    if (error) {
      onMessage?.(error.message, 'error');
      return;
    }
    onMessage?.('Payment screenshot shared with our team.', 'success');
    onSubmitted?.();
  };

  const submitted = hasPatientPaymentProof(request);
  const isImage =
    request.payment_proof_mime_type?.startsWith('image/') ||
    /\.(jpe?g|png|webp|heic|heif)$/i.test(request.payment_proof_file_name ?? '');

  return (
    <div className='patient-payment-proof'>
      <p className='patient-payment-proof__label'>Payment confirmation</p>
      <p className='muted patient-payment-proof__hint'>
        After you pay using the external link, upload a screenshot or receipt so our team can verify
        your payment.
      </p>

      {submitted ? (
        <div className='patient-payment-proof__submitted'>
          <p className='patient-payment-proof__status'>
            Screenshot shared{' '}
            {request.payment_proof_submitted_at
              ? new Date(request.payment_proof_submitted_at).toLocaleString()
              : ''}
            {request.payment_proof_file_name ? ` · ${request.payment_proof_file_name}` : ''}
          </p>
          {previewUrl && isImage ? (
            <a href={previewUrl} target='_blank' rel='noreferrer' className='patient-payment-proof__preview-link'>
              <img src={previewUrl} alt='Payment proof preview' className='patient-payment-proof__preview' />
            </a>
          ) : previewUrl ? (
            <a href={previewUrl} target='_blank' rel='noreferrer' className='text-btn'>
              View uploaded proof
            </a>
          ) : null}
        </div>
      ) : null}

      <input
        ref={inputRef}
        type='file'
        accept='image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf'
        className='patient-payment-proof__input'
        disabled={disabled || busy}
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          e.target.value = '';
          void handleFile(file);
        }}
      />

      <button
        type='button'
        className='secondary-btn patient-payment-proof__upload-btn'
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <>
            <Loader2 size={16} className='spin' aria-hidden /> Uploading…
          </>
        ) : (
          <>
            <ImagePlus size={16} aria-hidden />
            {submitted ? 'Replace screenshot' : 'Share payment screenshot'}
          </>
        )}
      </button>
    </div>
  );
}

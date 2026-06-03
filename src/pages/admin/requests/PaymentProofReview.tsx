import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { IconPhoto } from '@tabler/icons-react';
import ImageLightboxGallery, { type LightboxImageItem } from '../../../components/common/ImageLightboxGallery';
import { isImageUpload } from '../../../lib/imageFiles';
import { getMedicalRecordDownloadUrl } from '../../../lib/records';
import type { OpinionRequest } from '../../../types/opinionRequest';

type PaymentProofReviewProps = {
  request: OpinionRequest;
};

export default function PaymentProofReview({ request }: PaymentProofReviewProps) {
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submitted = Boolean(
    request.payment_proof_submitted_at && request.payment_proof_storage_path
  );
  const isImage = isImageUpload(
    request.payment_proof_file_name,
    request.payment_proof_mime_type
  );

  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;

    async function load() {
      if (!request.payment_proof_storage_path) {
        setProofUrl(null);
        setLoadError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await getMedicalRecordDownloadUrl(request.payment_proof_storage_path, {
        requestId: request.id
      });
      if (cancelled) return;
      setLoading(false);
      if (error || !data?.signedUrl) {
        setProofUrl(null);
        setLoadError(error?.message ?? 'Could not load payment proof.');
        return;
      }
      revoke = data.signedUrl;
      setProofUrl(data.signedUrl);
      setLoadError(null);
    }

    void load();
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [request.id, request.payment_proof_storage_path, request.payment_proof_submitted_at]);

  const lightboxImages = useMemo<LightboxImageItem[]>(() => {
    if (!proofUrl || !isImage) return [];
    return [
      {
        id: 'payment-proof',
        src: proofUrl,
        alt: request.payment_proof_file_name ?? 'Patient payment proof',
        caption: request.payment_proof_file_name ?? undefined
      }
    ];
  }, [proofUrl, isImage, request.payment_proof_file_name]);

  if (!submitted) {
    return (
      <Alert color='gray' radius='md' title='No payment proof yet'>
        The patient has not shared a payment screenshot. They can upload one after paying via your
        external link.
      </Alert>
    );
  }

  return (
    <Paper withBorder p='md' radius='md' className='pse-payment-proof-review'>
      <Stack gap='sm'>
        <Group gap='xs'>
          <IconPhoto size={18} aria-hidden />
          <Text fw={600} size='sm'>
            Patient payment proof
          </Text>
        </Group>
        <Text size='xs' c='dimmed'>
          Received {new Date(request.payment_proof_submitted_at!).toLocaleString()}
          {request.payment_proof_file_name ? ` · ${request.payment_proof_file_name}` : ''}
        </Text>

        {loadError ? (
          <Text size='sm' c='red'>
            {loadError}
          </Text>
        ) : null}

        {isImage ? (
          <>
            <Text size='xs' c='dimmed'>
              Click the thumbnail to view full size.
            </Text>
            <ImageLightboxGallery
              images={lightboxImages}
              loading={loading}
              error={loadError}
            />
          </>
        ) : proofUrl ? (
          <Button component='a' href={proofUrl} target='_blank' rel='noreferrer' variant='light' radius='md'>
            Open payment proof
          </Button>
        ) : loading ? (
          <ImageLightboxGallery images={[]} loading error={null} />
        ) : null}
      </Stack>
    </Paper>
  );
}

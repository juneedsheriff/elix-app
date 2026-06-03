import { useEffect, useMemo, useState } from 'react';
import { Button, Group, Paper, Stack, Text } from '@mantine/core';
import { IconFileText } from '@tabler/icons-react';
import ImageLightboxGallery, { type LightboxImageItem } from '../../../components/common/ImageLightboxGallery';
import { isImageFileName } from '../../../lib/imageFiles';
import { getMedicalRecordDownloadUrl } from '../../../lib/records';
import type { OpinionRequestFile } from '../../../types/opinionRequest';

type PseRequestRecordsGalleryProps = {
  records: OpinionRequestFile[];
  requestId: string;
  onOpenRecord: (storagePath: string) => void;
};

export default function PseRequestRecordsGallery({
  records,
  requestId,
  onOpenRecord
}: PseRequestRecordsGalleryProps) {
  const imageRecords = useMemo(
    () => records.filter((r) => r.storage_path && isImageFileName(r.file_name)),
    [records]
  );
  const otherRecords = useMemo(
    () => records.filter((r) => !r.storage_path || !isImageFileName(r.file_name)),
    [records]
  );

  const [images, setImages] = useState<LightboxImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const urlsToRevoke: string[] = [];
    let cancelled = false;

    async function loadThumbnails() {
      if (imageRecords.length === 0) {
        setImages([]);
        setLoadError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(null);

      const results = await Promise.all(
        imageRecords.map(async (record) => {
          const { data, error } = await getMedicalRecordDownloadUrl(record.storage_path!, {
            requestId
          });
          if (error || !data?.signedUrl) {
            return { record, url: null as string | null, error: error?.message ?? 'Could not load image.' };
          }
          urlsToRevoke.push(data.signedUrl);
          return { record, url: data.signedUrl, error: null };
        })
      );

      if (cancelled) {
        urlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      const failed = results.find((r) => !r.url);
      if (failed) {
        setLoadError(failed.error ?? 'Could not load one or more images.');
      }

      setImages(
        results
          .filter((r): r is typeof r & { url: string } => Boolean(r.url))
          .map((r) => ({
            id: r.record.id,
            src: r.url,
            alt: r.record.file_name,
            caption: r.record.file_name
          }))
      );
      setLoading(false);
    }

    void loadThumbnails();
    return () => {
      cancelled = true;
      urlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageRecords, requestId]);

  if (records.length === 0) {
    return (
      <Text size='sm' c='dimmed'>
        No files attached. You can still proceed if the patient will upload later.
      </Text>
    );
  }

  return (
    <Stack gap='sm'>
      {imageRecords.length > 0 ? (
        <Stack gap='xs'>
          <Text size='xs' fw={600} c='dimmed' tt='uppercase'>
            Uploaded images — click to expand
          </Text>
          <ImageLightboxGallery images={images} loading={loading} error={loadError} />
        </Stack>
      ) : null}

      {otherRecords.length > 0 ? (
        <Stack gap='xs'>
          {imageRecords.length > 0 ? (
            <Text size='xs' fw={600} c='dimmed' tt='uppercase' mt='xs'>
              Other files
            </Text>
          ) : null}
          {otherRecords.map((record) => (
            <Paper key={record.id} radius='md' p='sm' withBorder>
              <Group justify='space-between' wrap='nowrap'>
                <Group gap='sm' wrap='nowrap'>
                  <IconFileText size={18} />
                  <Stack gap={2}>
                    <Text size='sm' fw={600}>
                      {record.file_name}
                    </Text>
                    {record.summary ? (
                      <Text size='xs' c='dimmed'>
                        {record.summary}
                      </Text>
                    ) : null}
                  </Stack>
                </Group>
                {record.storage_path ? (
                  <Button
                    variant='light'
                    color='cyan'
                    size='xs'
                    onClick={() => onOpenRecord(record.storage_path!)}
                  >
                    Open
                  </Button>
                ) : null}
              </Group>
            </Paper>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionIcon, Button, Group, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { IconExternalLink, IconFileText, IconTrash } from '@tabler/icons-react';
import ImageLightboxGallery, { type LightboxImageItem } from '../common/ImageLightboxGallery';
import { isImageFileName } from '../../lib/imageFiles';
import { getMedicalRecordDownloadUrl, openMedicalRecordByPath } from '../../lib/records';
import type { OpinionRequestFile } from '../../types/opinionRequest';

type RequestRecordsGalleryProps = {
  records: OpinionRequestFile[];
  requestId: string;
  /** @deprecated Prefer onOpenDocument — opens non-image files in a new tab. */
  onOpenRecord?: (storagePath: string) => void;
  /** Opens non-image documents in a new browser tab. Images use the lightbox. */
  onOpenDocument?: (storagePath: string, requestId: string) => void;
  /** When set, shows delete controls for each record (PSE verify-records). */
  onDeleteRecord?: (record: OpinionRequestFile) => void;
  deletingRecordId?: string | null;
  lightboxModalZIndex?: number;
};

export default function RequestRecordsGallery({
  records,
  requestId,
  onOpenRecord,
  onOpenDocument,
  onDeleteRecord,
  deletingRecordId = null,
  lightboxModalZIndex = 500
}: RequestRecordsGalleryProps) {
  const imageRecords = useMemo(
    () => records.filter((record) => record.storage_path && isImageFileName(record.file_name)),
    [records]
  );
  const otherRecords = useMemo(
    () => records.filter((record) => !record.storage_path || !isImageFileName(record.file_name)),
    [records]
  );

  const [images, setImages] = useState<LightboxImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openingPath, setOpeningPath] = useState<string | null>(null);

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

      const failed = results.find((result) => !result.url);
      if (failed) {
        setLoadError(failed.error ?? 'Could not load one or more images.');
      }

      setImages(
        results
          .filter((result): result is typeof result & { url: string } => Boolean(result.url))
          .map((result) => ({
            id: result.record.id,
            src: result.url,
            alt: result.record.file_name,
            caption: result.record.file_name
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

  const openDocument = useCallback(
    async (storagePath: string) => {
      if (onOpenDocument) {
        onOpenDocument(storagePath, requestId);
        return;
      }
      if (onOpenRecord) {
        onOpenRecord(storagePath);
        return;
      }

      setOpeningPath(storagePath);
      const { error } = await openMedicalRecordByPath(storagePath, { requestId });
      setOpeningPath(null);

      if (error) return;
    },
    [onOpenDocument, onOpenRecord, requestId]
  );

  if (records.length === 0) {
    return (
      <Text size='sm' c='dimmed'>
        No medical records attached yet.
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
          <ImageLightboxGallery
            images={images}
            loading={loading}
            error={loadError}
            modalZIndex={lightboxModalZIndex}
          />
          {onDeleteRecord
            ? imageRecords.map((record) => (
                <Paper key={record.id} radius='md' p='sm' withBorder>
                  <Group justify='space-between' wrap='nowrap'>
                    <Group gap='sm' wrap='nowrap'>
                      <IconFileText size={18} />
                      <Text size='sm' fw={600}>
                        {record.file_name}
                      </Text>
                    </Group>
                    <Tooltip label='Delete record'>
                      <ActionIcon
                        variant='subtle'
                        color='red'
                        radius='md'
                        aria-label={`Delete ${record.file_name}`}
                        loading={deletingRecordId === record.id}
                        disabled={Boolean(deletingRecordId)}
                        onClick={() => onDeleteRecord(record)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Paper>
              ))
            : null}
        </Stack>
      ) : null}

      {otherRecords.length > 0 ? (
        <Stack gap='xs'>
          {imageRecords.length > 0 ? (
            <Text size='xs' fw={600} c='dimmed' tt='uppercase' mt='xs'>
              Documents
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
                <Group gap='xs' wrap='nowrap'>
                  {record.storage_path ? (
                    <Button
                      variant='light'
                      color='cyan'
                      size='xs'
                      leftSection={<IconExternalLink size={14} stroke={1.6} />}
                      loading={openingPath === record.storage_path}
                      onClick={() => void openDocument(record.storage_path!)}
                    >
                      Open
                    </Button>
                  ) : null}
                  {onDeleteRecord ? (
                    <Tooltip label='Delete record'>
                      <ActionIcon
                        variant='subtle'
                        color='red'
                        radius='md'
                        aria-label={`Delete ${record.file_name}`}
                        loading={deletingRecordId === record.id}
                        disabled={Boolean(deletingRecordId)}
                        onClick={() => onDeleteRecord(record)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  ) : null}
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}

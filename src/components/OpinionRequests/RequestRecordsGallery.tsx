import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionIcon, Group, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { IconEye, IconFileText, IconTrash } from '@tabler/icons-react';
import ImageLightboxGallery, { type LightboxImageItem } from '../common/ImageLightboxGallery';
import { isImageFileName } from '../../lib/imageFiles';
import {
  medicalRecordCategoryId,
  medicalRecordCategoryLabel
} from '../../lib/medicalRecordCategories';
import { getMedicalRecordDownloadUrl, openMedicalRecordByPath } from '../../lib/records';
import type { OpinionRequestFile } from '../../types/opinionRequest';
import './request-records-gallery.css';

function recordCategoryLabel(record: OpinionRequestFile): string {
  if (record.record_category) {
    return medicalRecordCategoryLabel(medicalRecordCategoryId(record));
  }
  const summary = record.summary?.trim();
  if (summary) return summary;
  return medicalRecordCategoryLabel(null);
}

function isImageRecord(record: OpinionRequestFile): boolean {
  return Boolean(record.storage_path && isImageFileName(record.file_name));
}

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
  const imageRecords = useMemo(() => records.filter(isImageRecord), [records]);

  const [images, setImages] = useState<LightboxImageItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const thumbById = useMemo(() => {
    const map = new Map<string, string>();
    for (const image of images) map.set(image.id, image.src);
    return map;
  }, [images]);

  const imageIndexById = useMemo(() => {
    const map = new Map<string, number>();
    images.forEach((image, index) => map.set(image.id, index));
    return map;
  }, [images]);

  useEffect(() => {
    const urlsToRevoke: string[] = [];
    let cancelled = false;

    async function loadThumbnails() {
      if (imageRecords.length === 0) {
        setImages([]);
        setLoadError(null);
        return;
      }

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
      } else {
        setLoadError(null);
      }

      setImages(
        results
          .filter((result): result is typeof result & { url: string } => Boolean(result.url))
          .map((result) => ({
            id: result.record.id,
            src: result.url,
            alt: result.record.file_name,
            caption: `${result.record.file_name} · ${recordCategoryLabel(result.record)}`
          }))
      );
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

  const openRecord = useCallback(
    (record: OpinionRequestFile) => {
      const imageIndex = imageIndexById.get(record.id);
      if (imageIndex !== undefined) {
        setLightboxIndex(imageIndex);
        return;
      }
      if (record.storage_path) {
        void openDocument(record.storage_path);
      }
    },
    [imageIndexById, openDocument]
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
      {loadError ? (
        <Text size='sm' c='red'>
          {loadError}
        </Text>
      ) : null}

      <Stack gap='xs'>
        {records.map((record) => {
          const thumbSrc = thumbById.get(record.id);
          const isOpening = Boolean(record.storage_path && openingPath === record.storage_path);

          return (
            <Paper
              key={record.id}
              radius='md'
              p='sm'
              withBorder
              className='request-records-gallery__card'
              role='button'
              tabIndex={0}
              aria-label={`Open ${record.file_name}`}
              data-opening={isOpening || undefined}
              onClick={() => openRecord(record)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openRecord(record);
                }
              }}
            >
              <Group justify='space-between' wrap='nowrap' align='center'>
                <Group gap='sm' wrap='nowrap' align='center' className='request-records-gallery__card-main'>
                  {thumbSrc ? (
                    <img
                      src={thumbSrc}
                      alt=''
                      className='request-records-gallery__thumb'
                      width={56}
                      height={56}
                    />
                  ) : (
                    <span className='request-records-gallery__file-icon' aria-hidden>
                      <IconFileText size={22} />
                    </span>
                  )}
                  <Stack gap={2} className='request-records-gallery__details'>
                    <Text size='sm' fw={600} lineClamp={2}>
                      {record.file_name}
                    </Text>
                    <Text size='xs' c='dimmed'>
                      {recordCategoryLabel(record)}
                    </Text>
                  </Stack>
                </Group>
                <Group gap='xs' wrap='nowrap'>
                  <Tooltip label='View record'>
                    <ActionIcon
                      variant='subtle'
                      color='cyan'
                      radius='md'
                      aria-label={`View ${record.file_name}`}
                      loading={isOpening}
                      onClick={(event) => {
                        event.stopPropagation();
                        openRecord(record);
                      }}
                    >
                      <IconEye size={18} />
                    </ActionIcon>
                  </Tooltip>
                  {onDeleteRecord ? (
                    <Tooltip label='Delete record'>
                      <ActionIcon
                        variant='subtle'
                        color='red'
                        radius='md'
                        aria-label={`Delete ${record.file_name}`}
                        loading={deletingRecordId === record.id}
                        disabled={Boolean(deletingRecordId)}
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteRecord(record);
                        }}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  ) : null}
                </Group>
              </Group>
            </Paper>
          );
        })}
      </Stack>

      <ImageLightboxGallery
        images={images}
        showGrid={false}
        openedIndex={lightboxIndex}
        onOpenedIndexChange={setLightboxIndex}
        modalZIndex={lightboxModalZIndex}
      />
    </Stack>
  );
}

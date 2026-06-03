import { useCallback, useEffect, useState } from 'react';
import { ActionIcon, Modal, Skeleton, Text } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react';
import './image-lightbox.css';

export type LightboxImageItem = {
  id: string;
  src: string;
  alt: string;
  caption?: string;
};

type ImageLightboxGalleryProps = {
  images: LightboxImageItem[];
  loading?: boolean;
  error?: string | null;
  className?: string;
};

export default function ImageLightboxGallery({
  images,
  loading = false,
  error = null,
  className = ''
}: ImageLightboxGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const active = activeIndex !== null ? images[activeIndex] : null;
  const hasMultiple = images.length > 1;

  const close = useCallback(() => setActiveIndex(null), []);

  const goPrev = useCallback(() => {
    if (activeIndex === null || images.length < 2) return;
    setActiveIndex((activeIndex - 1 + images.length) % images.length);
  }, [activeIndex, images.length]);

  const goNext = useCallback(() => {
    if (activeIndex === null || images.length < 2) return;
    setActiveIndex((activeIndex + 1) % images.length);
  }, [activeIndex, images.length]);

  useEffect(() => {
    if (activeIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, close, goPrev, goNext]);

  useEffect(() => {
    if (activeIndex !== null && activeIndex >= images.length) {
      setActiveIndex(images.length ? images.length - 1 : null);
    }
  }, [activeIndex, images.length]);

  if (!loading && !error && images.length === 0) {
    return null;
  }

  return (
    <div className={`image-lightbox-gallery ${className}`.trim()}>
      {error ? (
        <Text size='sm' c='red' mb='xs'>
          {error}
        </Text>
      ) : null}

      {loading ? (
        <div className='image-lightbox-gallery__grid' aria-busy='true'>
          {[0, 1, 2].slice(0, Math.max(1, images.length || 2)).map((i) => (
            <Skeleton key={i} className='image-lightbox-gallery__skeleton' radius='md' />
          ))}
        </div>
      ) : (
        <div className='image-lightbox-gallery__grid' role='list'>
          {images.map((image, index) => (
            <button
              key={image.id}
              type='button'
              className='image-lightbox-gallery__thumb'
              onClick={() => setActiveIndex(index)}
              aria-label={`View ${image.alt}`}
            >
              <img src={image.src} alt='' loading='lazy' />
              {image.caption ? (
                <span className='image-lightbox-gallery__thumb-label'>{image.caption}</span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      <Modal
        opened={activeIndex !== null && Boolean(active)}
        onClose={close}
        fullScreen
        withCloseButton={false}
        padding={0}
        classNames={{ content: 'image-lightbox-modal', body: 'image-lightbox-modal__body' }}
        overlayProps={{ backgroundOpacity: 0.85, blur: 2 }}
        transitionProps={{ transition: 'fade', duration: 150 }}
        zIndex={500}
      >
        {active ? (
          <>
            {hasMultiple ? (
              <Text className='image-lightbox-modal__counter' size='xs'>
                {(activeIndex ?? 0) + 1} / {images.length}
              </Text>
            ) : null}
            <ActionIcon
              variant='subtle'
              color='gray'
              size='lg'
              aria-label='Close'
              onClick={close}
              style={{ position: 'absolute', top: 8, right: 8, zIndex: 3 }}
            >
              <IconX size={22} />
            </ActionIcon>
            {hasMultiple ? (
              <>
                <ActionIcon
                  className='image-lightbox-modal__nav image-lightbox-modal__nav--prev'
                  variant='light'
                  color='gray'
                  size='xl'
                  radius='xl'
                  aria-label='Previous image'
                  onClick={goPrev}
                >
                  <IconChevronLeft size={22} />
                </ActionIcon>
                <ActionIcon
                  className='image-lightbox-modal__nav image-lightbox-modal__nav--next'
                  variant='light'
                  color='gray'
                  size='xl'
                  radius='xl'
                  aria-label='Next image'
                  onClick={goNext}
                >
                  <IconChevronRight size={22} />
                </ActionIcon>
              </>
            ) : null}
            <img src={active.src} alt={active.alt} className='image-lightbox-modal__img' />
            {active.caption ? (
              <Text className='image-lightbox-modal__caption' size='sm'>
                {active.caption}
              </Text>
            ) : null}
          </>
        ) : null}
      </Modal>
    </div>
  );
}

const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif|gif)$/i;

export const PROFILE_AVATAR_SIZE = 512;

export function isImageFileName(fileName: string | null | undefined): boolean {
  if (!fileName?.trim()) return false;
  return IMAGE_EXT.test(fileName.trim());
}

export function isImageMimeType(mimeType: string | null | undefined): boolean {
  return Boolean(mimeType?.startsWith('image/'));
}

export function isImageUpload(fileName: string | null | undefined, mimeType?: string | null): boolean {
  return isImageMimeType(mimeType) || isImageFileName(fileName);
}

const ACCEPTED_PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function isAcceptedProfileImageFile(file: File): boolean {
  if (ACCEPTED_PROFILE_IMAGE_TYPES.has(file.type)) return true;
  if (isImageMimeType(file.type)) return true;
  if (!file.type && file.name) return isImageFileName(file.name);
  return false;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/** Center-crop video frame to square and resize; output is JPEG data URL. */
export function captureVideoFrameToSquareDataUrl(
  video: HTMLVideoElement,
  size = PROFILE_AVATAR_SIZE,
  quality = 0.85
): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error('Camera preview not ready');

  const sourceSize = Math.min(vw, vh);
  const sx = (vw - sourceSize) / 2;
  const sy = (vh - sourceSize) / 2;

  ctx.drawImage(video, sx, sy, sourceSize, sourceSize, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Center-crop to square and resize; output is JPEG data URL for compact storage. */
export async function resizeImageFileToSquareDataUrl(
  file: File,
  size = PROFILE_AVATAR_SIZE,
  quality = 0.85
): Promise<string> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await loadImageElement(objectUrl);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');

    const sourceSize = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - sourceSize) / 2;
    const sy = (img.naturalHeight - sourceSize) / 2;

    ctx.drawImage(img, sx, sy, sourceSize, sourceSize, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

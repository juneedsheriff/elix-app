const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif|gif)$/i;

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

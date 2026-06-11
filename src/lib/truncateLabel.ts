export function truncateLabel(text: string, maxLength = 20): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}...`;
}

/** Truncate the base name only; keep the file extension visible (e.g. `long-name….jpg`). */
export function truncateFileName(fileName: string, maxBaseLength = 20): string {
  const trimmed = fileName.trim();
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot <= 0) {
    return truncateLabel(trimmed, maxBaseLength);
  }

  const base = trimmed.slice(0, lastDot);
  const extension = trimmed.slice(lastDot);
  if (base.length <= maxBaseLength) return trimmed;
  return `${base.slice(0, maxBaseLength)}...${extension}`;
}

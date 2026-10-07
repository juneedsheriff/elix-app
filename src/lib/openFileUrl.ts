/**
 * Open URLs in a new tab in a way that works on iOS Safari.
 * window.open() after await is blocked; opening about:blank synchronously then
 * navigating after the blob URL is ready avoids that.
 */

export function openUrlInNewTab(url: string, fileName?: string): void {
  if (!url || typeof window === 'undefined') return;

  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  if (fileName) link.setAttribute('download', fileName);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function mimeTypeForFileName(fileName: string, reported?: string | null): string {
  const reportedType = reported?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (reportedType && reportedType !== 'application/octet-stream') return reportedType;
  const ext = fileName.trim().toLowerCase().split('.').pop() ?? '';
  const byExt: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    txt: 'text/plain',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  return byExt[ext] || reportedType || 'application/octet-stream';
}

/** Call synchronously inside a click handler before any await. */
export function prepareAsyncOpenInNewTab(): Window | null {
  if (typeof window === 'undefined') return null;
  let popup: Window | null = null;
  try {
    popup = window.open('', '_blank');
  } catch {
    return null;
  }
  if (!popup) return null;
  // Give Safari a real document immediately so it does not discard the tab
  // while the file downloads.
  try {
    popup.document.open();
    popup.document.write(
      '<!DOCTYPE html><title>Opening file…</title><p style="font-family:sans-serif;padding:1.25rem">Opening file…</p>'
    );
    popup.document.close();
  } catch {
    /* The tab is still open; the file URL can replace it after download. */
  }
  return popup;
}

/** Show an already-downloaded file in a tab that was opened during the click. */
export function openBlobInPreparedTab(
  preparedWindow: Window | null,
  blob: Blob,
  fileName: string
): boolean {
  const type = mimeTypeForFileName(fileName, blob.type);
  const fileBlob = blob.type === type ? blob : new Blob([blob], { type });
  const url = URL.createObjectURL(fileBlob);

  const navigate = (target: Window) => {
    try {
      target.location.replace(url);
      return true;
    } catch {
      try {
        target.location.href = url;
        return true;
      } catch {
        return false;
      }
    }
  };

  if (preparedWindow && !preparedWindow.closed && navigate(preparedWindow)) {
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return true;
  }

  if (preparedWindow && !preparedWindow.closed) {
    try {
      preparedWindow.close();
    } catch {
      /* ignore */
    }
  }

  const opened = window.open(url, '_blank');
  if (!opened) {
    openUrlInNewTab(url);
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  return Boolean(opened);
}

/** Open a file that is already loaded. Call this only after loading finishes. */
export function openLoadedFileInNewTab(blob: Blob, fileName: string): void {
  const type = mimeTypeForFileName(fileName, blob.type);
  const fileBlob = new Blob([blob], { type });
  const url = URL.createObjectURL(fileBlob);
  const opened = window.open(url, '_blank');
  if (!opened) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

export function completeAsyncOpenInNewTab(
  preparedWindow: Window | null,
  url: string,
  fileName?: string
): void {
  if (preparedWindow && !preparedWindow.closed) {
    try {
      preparedWindow.location.href = url;
      return;
    } catch {
      try {
        preparedWindow.close();
      } catch {
        /* ignore */
      }
    }
  }
  openUrlInNewTab(url, fileName);
}

/**
 * Android/iOS Chrome only show the real PDF viewer for a top-level PDF tab,
 * not inside an iframe. Re-wrap bytes as application/pdf so Chrome recognizes it.
 */
export async function openPdfInNativeViewer(
  sourceUrl: string,
  fileName = 'document.pdf'
): Promise<void> {
  const prepared = prepareAsyncOpenInNewTab();
  const safeName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;

  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    const file = new File([buffer], safeName, { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(file);
    completeAsyncOpenInNewTab(prepared, blobUrl);
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
  } catch {
    completeAsyncOpenInNewTab(prepared, sourceUrl, safeName);
  }
}

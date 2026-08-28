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

/** Call synchronously inside a click handler before any await. */
export function prepareAsyncOpenInNewTab(): Window | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.open('about:blank', '_blank');
  } catch {
    return null;
  }
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

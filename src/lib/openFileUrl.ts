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

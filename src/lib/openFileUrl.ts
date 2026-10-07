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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function openingFileDocument(fileName: string): string {
  const safeName = escapeHtml(fileName || 'File');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Opening file</title>
<style>
  html, body { margin: 0; height: 100%; background: rgba(15, 23, 42, 0.45); font-family: system-ui, sans-serif; }
  body { display: grid; place-items: center; padding: 1.25rem; box-sizing: border-box; }
  .card { width: min(100%, 22rem); display: grid; justify-items: center; gap: 0.45rem; padding: 1.35rem 1.25rem 1.2rem; border-radius: 18px; background: #fff; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.22); text-align: center; color: #0f172a; }
  .spinner { width: 28px; height: 28px; border-radius: 50%; border: 3px solid #e2e8f0; border-top-color: #09abc0; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .title { margin: 0.15rem 0 0; font-size: 1.05rem; font-weight: 700; }
  .name { margin: 0; max-width: 100%; font-size: 0.85rem; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .track { width: 100%; height: 0.55rem; margin-top: 0.45rem; border-radius: 999px; background: #e2e8f0; overflow: hidden; }
  .bar { display: block; height: 100%; width: 0%; border-radius: inherit; background: linear-gradient(90deg, #09abc0, #0284c7); }
  .percent { margin: 0.15rem 0 0; font-size: 1.35rem; font-weight: 800; letter-spacing: -0.02em; }
  .hint { margin: 0; font-size: 0.8rem; line-height: 1.4; color: #64748b; }
</style>
</head>
<body>
  <div class="card" role="status">
    <div class="spinner" aria-hidden="true"></div>
    <p class="title">Opening file</p>
    <p class="name" id="urv-name">${safeName}</p>
    <div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <span class="bar" id="urv-bar"></span>
    </div>
    <p class="percent" id="urv-percent">0%</p>
    <p class="hint" id="urv-hint">The file is opening in your browser. It will appear when ready.</p>
  </div>
</body>
</html>`;
}

/** Call synchronously inside a click handler before any await. */
export function prepareAsyncOpenInNewTab(fileName = ''): Window | null {
  if (typeof window === 'undefined') return null;
  let popup: Window | null = null;
  try {
    popup = window.open('', '_blank');
  } catch {
    return null;
  }
  if (!popup) return null;
  // Give Safari a real document immediately so it does not discard the tab
  // while the file downloads. Keep this page in front so the progress modal
  // stays visible until the file is ready.
  try {
    popup.document.open();
    popup.document.write(openingFileDocument(fileName));
    popup.document.close();
  } catch {
    /* The tab is still open; the file URL can replace it after download. */
  }
  try {
    window.focus();
  } catch {
    /* Safari may keep the new tab in front; that tab shows the same progress. */
  }
  return popup;
}

/** Keep the pre-opened tab's progress card in step with the download modal. */
export function updatePreparedTabProgress(
  preparedWindow: Window | null,
  percent: number,
  fileName?: string
): void {
  if (!preparedWindow || preparedWindow.closed) return;
  const shown = Math.max(0, Math.min(100, Math.round(percent)));
  try {
    const doc = preparedWindow.document;
    if (fileName) {
      const name = doc.getElementById('urv-name');
      if (name) name.textContent = fileName;
    }
    const bar = doc.getElementById('urv-bar');
    if (bar) bar.style.width = `${shown}%`;
    const label = doc.getElementById('urv-percent');
    if (label) label.textContent = `${shown}%`;
    const hint = doc.getElementById('urv-hint');
    if (hint) {
      hint.textContent =
        shown >= 100
          ? 'File ready. Opening it…'
          : 'The file is opening in your browser. It will appear when ready.';
    }
    const track = doc.querySelector('[role="progressbar"]');
    if (track) track.setAttribute('aria-valuenow', String(shown));
  } catch {
    /* Tab navigated away or was closed. */
  }
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
    try {
      preparedWindow.focus();
    } catch {
      /* The file is already loaded in that tab. */
    }
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

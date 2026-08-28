import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Minus, Plus } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './react-pdf-document-viewer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type ReactPdfDocumentViewerProps = {
  src: string;
  title: string;
};

export default function ReactPdfDocumentViewer({ src, title }: ReactPdfDocumentViewerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(320);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;

    const updateWidth = () => {
      const next = Math.floor(node.clientWidth - 16);
      if (next > 0) setPageWidth(next);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFileData(null);
    setNumPages(0);

    void fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error('Could not load PDF.');
        return response.arrayBuffer();
      })
      .then((buffer) => {
        if (cancelled) return;
        setFileData(buffer.slice(0));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load PDF.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  const file = useMemo(() => (fileData ? { data: fileData } : null), [fileData]);
  const width = Math.max(200, Math.floor(pageWidth * scale));

  return (
    <div className='react-pdf-document-viewer' aria-label={title}>
      <div className='react-pdf-document-viewer__toolbar'>
        <span className='react-pdf-document-viewer__count'>
          {numPages > 0 ? `${numPages} page${numPages === 1 ? '' : 's'}` : 'PDF'}
        </span>
        <div className='react-pdf-document-viewer__zoom'>
          <button
            type='button'
            className='react-pdf-document-viewer__zoom-btn'
            aria-label='Zoom out'
            disabled={scale <= 0.7}
            onClick={() => setScale((current) => Math.max(0.7, Number((current - 0.15).toFixed(2))))}
          >
            <Minus size={16} />
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button
            type='button'
            className='react-pdf-document-viewer__zoom-btn'
            aria-label='Zoom in'
            disabled={scale >= 2}
            onClick={() => setScale((current) => Math.min(2, Number((current + 0.15).toFixed(2))))}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <p className='react-pdf-document-viewer__status'>
          <Loader2 size={16} className='spin' aria-hidden /> Loading PDF…
        </p>
      ) : null}
      {error ? (
        <p className='react-pdf-document-viewer__status react-pdf-document-viewer__status--error' role='alert'>
          {error}
        </p>
      ) : null}

      <div ref={wrapRef} className='react-pdf-document-viewer__pages'>
        {file ? (
          <Document
            file={file}
            loading={null}
            onLoadSuccess={({ numPages: next }) => setNumPages(next)}
            onLoadError={(loadError) => setError(loadError.message || 'Could not display this PDF.')}
          >
            {Array.from({ length: numPages }, (_, index) => (
              <Page
                key={`page-${index + 1}`}
                pageNumber={index + 1}
                width={width}
                renderAnnotationLayer
                renderTextLayer
              />
            ))}
          </Document>
        ) : null}
      </div>
    </div>
  );
}

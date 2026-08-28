import { useState } from 'react';
import { ExternalLink, FileText, Loader2 } from 'lucide-react';
import { openPdfInNativeViewer } from '../../lib/openFileUrl';

type OpenNativePdfPanelProps = {
  src: string;
  fileName?: string;
  label?: string;
};

export default function OpenNativePdfPanel({
  src,
  fileName = 'document.pdf',
  label = 'Open in PDF viewer'
}: OpenNativePdfPanelProps) {
  const [busy, setBusy] = useState(false);

  const handleOpen = () => {
    setBusy(true);
    void openPdfInNativeViewer(src, fileName).finally(() => setBusy(false));
  };

  return (
    <button
      type='button'
      className='consultation-summary-pdf__native-open'
      onClick={handleOpen}
      disabled={busy}
    >
      <span className='consultation-summary-pdf__native-open-icon' aria-hidden>
        {busy ? <Loader2 size={28} className='spin' /> : <FileText size={28} strokeWidth={1.75} />}
      </span>
      <span className='consultation-summary-pdf__native-open-copy'>
        <strong>{busy ? 'Opening…' : label}</strong>
        <span>Opens in your browser’s PDF viewer</span>
      </span>
      <ExternalLink size={18} aria-hidden />
    </button>
  );
}

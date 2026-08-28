import { useEffect, useState } from 'react';

/** Chrome/Safari on phones do not render PDFs inside iframes (UUID + Open card). */
export function cannotEmbedPdfInIframe(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return true;

  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isIos =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isAndroid || isIos) return true;

  const narrow = window.matchMedia('(max-width: 1024px)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  return narrow && coarse;
}

export function useCannotEmbedPdfInIframe(): boolean {
  const [value, setValue] = useState(cannotEmbedPdfInIframe);

  useEffect(() => {
    const update = () => setValue(cannotEmbedPdfInIframe());
    update();
    const narrow = window.matchMedia('(max-width: 1024px)');
    narrow.addEventListener('change', update);
    return () => narrow.removeEventListener('change', update);
  }, []);

  return value;
}

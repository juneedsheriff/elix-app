/** Registers a minimal service worker so installable PWA prompts can appear. */
export function registerElixServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('[pwa] service worker registration failed:', error);
    });
  });
}

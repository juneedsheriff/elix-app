import '@khmyznikov/pwa-install';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PWAInstallElement } from '../../types/pwa-install';

const INSTALL_DESCRIPTION =
  'This site has app functionality. Install it on your device for a better experience and easy access.';

const PWA_STYLES = { '--tint-color': '#09abc0' };

const PWA_TOP_POSITION_STYLE_ID = 'elix-pwa-install-top-position';

function applyTopPositionStyle(el: PWAInstallElement) {
  const root = el.shadowRoot;
  if (!root || root.getElementById(PWA_TOP_POSITION_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = PWA_TOP_POSITION_STYLE_ID;
  style.textContent = `
    #pwa-install-element .install-dialog.mobile.available {
      --translateY: translateY(0) !important;
      top: max(12px, env(safe-area-inset-top)) !important;
      bottom: auto !important;
      transform: translateY(0) !important;
      max-height: min(440px, calc(100dvh - 24px - env(safe-area-inset-top))) !important;
    }
  `;
  root.appendChild(style);
}

export default function AuthInstallAppPrompt() {
  const installRef = useRef<PWAInstallElement | null>(null);
  const [portalMounted, setPortalMounted] = useState(false);
  const [canOfferInstall, setCanOfferInstall] = useState(false);
  const [installed, setInstalled] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
  );

  // Inject the pre-captured beforeinstallprompt so the component shows the
  // proper Install dialog instead of manual "Open browser menu" instructions.
  const attachInstallRef = useCallback((node: PWAInstallElement | null) => {
    installRef.current = node;
    if (!node) return;

    const captured = (window as unknown as Record<string, unknown>).__elixInstallPrompt;
    if (captured) {
      node.externalPromptEvent = captured as BeforeInstallPromptEvent;
    }
  }, []);

  const openInstallDialog = useCallback(() => {
    const el = installRef.current;
    if (!el || el.isUnderStandaloneMode) return;
    applyTopPositionStyle(el);
    el.showDialog(true);
  }, []);

  // Mount portal only on client
  useEffect(() => {
    if (!installed) setPortalMounted(true);
  }, [installed]);

  useEffect(() => {
    const el = installRef.current;
    if (!el) return;

    if (el.isUnderStandaloneMode) {
      setInstalled(true);
      setCanOfferInstall(false);
      return;
    }

    const onAvailable = () => {
      setCanOfferInstall(true);
      applyTopPositionStyle(el);
      el.showDialog();
    };

    const onSuccess = () => {
      setInstalled(true);
      setCanOfferInstall(false);
    };

    el.addEventListener('pwa-install-available-event', onAvailable);
    el.addEventListener('pwa-install-success-event', onSuccess);

    return () => {
      el.removeEventListener('pwa-install-available-event', onAvailable);
      el.removeEventListener('pwa-install-success-event', onSuccess);
    };
  }, [portalMounted]);

  // Don't render anything once already installed as a PWA
  if (installed) return null;

  const installElement = (
    <pwa-install
      ref={attachInstallRef}
      manual-chrome='true'
      manual-apple='true'
      use-local-storage='true'
      manifest-url='/manifest.webmanifest'
      icon='/icons/icon-192.png'
      name='ElixClinix'
      description='Expert care, informed decisions'
      install-description={INSTALL_DESCRIPTION}
      styles={PWA_STYLES}
    />
  );

  return (
    <>
      {portalMounted ? createPortal(installElement, document.body) : null}
      {canOfferInstall ? (
        <button type='button' className='auth-page__install-link text-btn' onClick={openInstallDialog}>
          Install app
        </button>
      ) : null}
    </>
  );
}

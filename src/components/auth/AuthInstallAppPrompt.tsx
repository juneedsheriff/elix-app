import '@khmyznikov/pwa-install';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PWAInstallElement } from '../../types/pwa-install';

const INSTALL_DESCRIPTION =
  'This site has app functionality. Install it on your device for a better experience and easy access.';

const PWA_STYLES = { '--tint-color': '#09abc0' };

const PWA_TOP_POSITION_STYLE_ID = 'elix-pwa-install-top-position';

function applyTopInstallPromptLayout(el: PWAInstallElement) {
  const root = el.shadowRoot;
  if (!root || root.getElementById(PWA_TOP_POSITION_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = PWA_TOP_POSITION_STYLE_ID;
  style.textContent = `
    #pwa-install-element .install-dialog.mobile.available {
      --translateY: translateY(0);
      top: max(12px, env(safe-area-inset-top));
      bottom: auto;
      transform: var(--translateY);
      max-height: min(420px, calc(100dvh - 24px - env(safe-area-inset-top)));
    }

    #pwa-install-element .install-dialog.chrome.mobile.available {
      --translateY: translateY(0);
    }
  `;
  root.appendChild(style);
}

export default function AuthInstallAppPrompt() {
  const installRef = useRef<PWAInstallElement | null>(null);
  const [installNode, setInstallNode] = useState<PWAInstallElement | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [canOfferInstall, setCanOfferInstall] = useState(false);

  const attachInstallRef = useCallback((node: PWAInstallElement | null) => {
    installRef.current = node;
    setInstallNode(node);
  }, []);

  const openInstallDialog = useCallback(() => {
    const el = installRef.current;
    if (!el || el.isUnderStandaloneMode) return;
    applyTopInstallPromptLayout(el);
    // pass true to force isInstallAvailable = true even if the browser
    // prompt hasn't been captured yet (manual-chrome / manual-apple modes)
    el.showDialog(true);
  }, []);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    const el = installNode;
    if (!el) return;

    applyTopInstallPromptLayout(el);

    if (el.isUnderStandaloneMode) {
      setCanOfferInstall(false);
      return;
    }

    setCanOfferInstall(true);

    const showDialogIfNeeded = () => {
      if (!el.isUnderStandaloneMode) {
        applyTopInstallPromptLayout(el);
        el.showDialog(true);
      }
    };

    const onAvailable = () => showDialogIfNeeded();
    const onSuccess = () => setCanOfferInstall(false);

    el.addEventListener('pwa-install-available-event', onAvailable);
    el.addEventListener('pwa-install-success-event', onSuccess);

    const timer = window.setTimeout(showDialogIfNeeded, 700);

    return () => {
      clearTimeout(timer);
      el.removeEventListener('pwa-install-available-event', onAvailable);
      el.removeEventListener('pwa-install-success-event', onSuccess);
    };
  }, [installNode]);

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
      {portalTarget ? createPortal(installElement, portalTarget) : null}
      {canOfferInstall ? (
        <button type='button' className='auth-page__install-link text-btn' onClick={openInstallDialog}>
          Install app
        </button>
      ) : null}
    </>
  );
}

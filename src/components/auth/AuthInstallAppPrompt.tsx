import '@khmyznikov/pwa-install';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PwaInstallElement } from '../../types/pwa-install';

const INSTALL_DESCRIPTION =
  'This site has app functionality. Install it on your device for a better experience and easy access.';

const PWA_STYLES = JSON.stringify({ '--tint-color': '#09abc0' });

export default function AuthInstallAppPrompt() {
  const installRef = useRef<PwaInstallElement | null>(null);
  const [installNode, setInstallNode] = useState<PwaInstallElement | null>(null);
  const [canOfferInstall, setCanOfferInstall] = useState(false);

  const attachInstallRef = useCallback((node: PwaInstallElement | null) => {
    installRef.current = node;
    setInstallNode(node);
  }, []);

  const openInstallDialog = useCallback(() => {
    const el = installRef.current;
    if (!el || el.isUnderStandaloneMode) return;
    el.showDialog();
  }, []);

  useEffect(() => {
    const el = installNode;
    if (!el) return;

    if (el.isUnderStandaloneMode) {
      setCanOfferInstall(false);
      return;
    }

    setCanOfferInstall(true);

    const showDialogIfNeeded = () => {
      if (!el.isUnderStandaloneMode) {
        el.showDialog();
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

  return (
    <>
      <pwa-install
        ref={attachInstallRef}
        manual-chrome
        manual-apple
        use-local-storage
        manifest-url='/manifest.webmanifest'
        icon='/icons/icon-192.png'
        name='ElixClinix'
        description='Expert care, informed decisions'
        install-description={INSTALL_DESCRIPTION}
        styles={PWA_STYLES}
      />
      {canOfferInstall ? (
        <button type='button' className='auth-page__install-link text-btn' onClick={openInstallDialog}>
          Install app
        </button>
      ) : null}
    </>
  );
}

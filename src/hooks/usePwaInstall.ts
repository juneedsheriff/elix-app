import { useCallback, useEffect, useRef, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export type PwaInstallHint = 'ios' | 'android' | null;

function isStandaloneDisplayMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosDevice() {
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua);
}

function isAndroidDevice() {
  return /android/i.test(window.navigator.userAgent);
}

export function usePwaInstall() {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canPromptInstall, setCanPromptInstall] = useState(false);
  const [installHint, setInstallHint] = useState<PwaInstallHint>(null);
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneDisplayMode());
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isStandaloneDisplayMode()) {
      setIsInstalled(true);
      return;
    }

    if (isIosDevice()) {
      setInstallHint('ios');
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      setCanPromptInstall(true);
      setInstallHint(null);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setCanPromptInstall(false);
      setInstallHint(null);
      deferredPromptRef.current = null;
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const showInstallOption =
    !isInstalled && (canPromptInstall || installHint !== null || isIosDevice() || isAndroidDevice());

  const install = useCallback(async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) {
      if (isAndroidDevice()) {
        setInstallHint('android');
      }
      return false;
    }

    setInstalling(true);
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        setCanPromptInstall(false);
        deferredPromptRef.current = null;
        return true;
      }
      return false;
    } finally {
      setInstalling(false);
    }
  }, []);

  return {
    showInstallOption,
    canPromptInstall,
    installHint,
    isInstalled,
    installing,
    install
  };
}

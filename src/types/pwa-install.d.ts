import type { DetailedHTMLProps, HTMLAttributes } from 'react';

export type PwaInstallElement = HTMLElement & {
  showDialog: () => void;
  hideDialog: () => void;
  install: () => void;
  isUnderStandaloneMode: boolean;
  isInstallAvailable: boolean;
  isDialogHidden: boolean;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'pwa-install': DetailedHTMLProps<
        HTMLAttributes<PwaInstallElement> & {
          'manual-chrome'?: boolean | string;
          'manual-apple'?: boolean | string;
          'use-local-storage'?: boolean | string;
          'manifest-url'?: string;
          name?: string;
          description?: string;
          icon?: string;
          'install-description'?: string;
          styles?: string;
        },
        PwaInstallElement
      >;
    }
  }
}

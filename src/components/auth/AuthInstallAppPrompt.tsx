import { Download, Smartphone } from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall';

export default function AuthInstallAppPrompt() {
  const { showInstallOption, canPromptInstall, installHint, installing, install } = usePwaInstall();

  if (!showInstallOption) {
    return null;
  }

  if (installHint === 'ios') {
    return (
      <div className='auth-page__install' role='note'>
        <span className='auth-page__install-icon' aria-hidden>
          <Smartphone size={18} />
        </span>
        <div className='auth-page__install-copy'>
          <strong>Install app</strong>
          <p>Tap Share in Safari, then <em>Add to Home Screen</em>.</p>
        </div>
      </div>
    );
  }

  if (installHint === 'android' && !canPromptInstall) {
    return (
      <div className='auth-page__install' role='note'>
        <span className='auth-page__install-icon' aria-hidden>
          <Smartphone size={18} />
        </span>
        <div className='auth-page__install-copy'>
          <strong>Install app</strong>
          <p>Open your browser menu and choose <em>Install app</em> or <em>Add to Home screen</em>.</p>
        </div>
      </div>
    );
  }

  return (
    <div className='auth-page__install auth-page__install--action'>
      <button
        type='button'
        className='auth-page__install-btn'
        disabled={installing}
        onClick={() => void install()}
      >
        <Download size={18} aria-hidden />
        {installing ? 'Installing…' : 'Install app'}
      </button>
      <p className='auth-page__install-help'>Add ElixClinix to your home screen for quick access.</p>
    </div>
  );
}

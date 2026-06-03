import { Loader2, Mic, MicOff, ShieldAlert } from 'lucide-react';
import type { MicrophonePermissionStatus } from '../../lib/speech/microphonePermission';

type MicrophonePermissionModalProps = {
  status: MicrophonePermissionStatus;
  requesting: boolean;
  onAllow: () => void;
  onContinueWithoutVoice: () => void;
};

export default function MicrophonePermissionModal({
  status,
  requesting,
  onAllow,
  onContinueWithoutVoice
}: MicrophonePermissionModalProps) {
  const isChecking = status === 'checking';
  const isDenied = status === 'denied';
  const isUnsupported = status === 'unsupported';

  return (
    <div className='mic-permission-modal-root' role='presentation'>
      <div className='mic-permission-modal-backdrop' aria-hidden />
      <div
        className='mic-permission-modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='mic-permission-modal-title'
        aria-describedby='mic-permission-modal-desc'
      >
        <div className='mic-permission-modal__icon' aria-hidden>
          {isUnsupported || isDenied ? <MicOff size={28} /> : <Mic size={28} />}
        </div>

        <h2 id='mic-permission-modal-title' className='mic-permission-modal__title'>
          {isUnsupported
            ? 'Microphone not available'
            : isDenied
              ? 'Microphone access blocked'
              : 'Allow microphone access'}
        </h2>

        <p id='mic-permission-modal-desc' className='mic-permission-modal__desc muted'>
          {isChecking
            ? 'Checking microphone permission…'
            : isUnsupported
              ? 'This browser does not support microphone access. You can still type your consultation notes manually.'
              : isDenied
                ? 'Voice dictation needs microphone access. Enable the mic for this site in your browser settings, then tap Try again.'
                : 'Voice dictation is available on this page. Allow microphone access so you can dictate consultation notes hands-free.'}
        </p>

        {isChecking ? (
          <p className='doctor-status mic-permission-modal__checking'>
            <Loader2 size={18} className='spin' aria-hidden /> Preparing…
          </p>
        ) : (
          <div className='mic-permission-modal__actions'>
            {!isUnsupported ? (
              <button
                type='button'
                className='primary-btn mic-permission-modal__allow'
                onClick={() => void onAllow()}
                disabled={requesting}
              >
                {requesting ? (
                  <>
                    <Loader2 size={16} className='spin' aria-hidden /> Waiting for permission…
                  </>
                ) : isDenied ? (
                  <>
                    <ShieldAlert size={16} aria-hidden /> Try again
                  </>
                ) : (
                  <>
                    <Mic size={16} aria-hidden /> Allow microphone
                  </>
                )}
              </button>
            ) : null}

            <button
              type='button'
              className='secondary-btn'
              onClick={onContinueWithoutVoice}
              disabled={requesting}
            >
              Continue without voice
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

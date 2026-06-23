import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Loader2, ShieldAlert, X } from 'lucide-react';
import { captureVideoFrameToSquareDataUrl } from '../../lib/imageFiles';
import {
  queryCameraPermission,
  requestCameraStream,
  stopMediaStream,
  type CameraPermissionStatus
} from '../../lib/cameraPermission';

type PatientCameraCaptureModalProps = {
  open: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
};

export default function PatientCameraCaptureModal({
  open,
  onClose,
  onCapture
}: PatientCameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraPermissionStatus>('checking');
  const [requesting, setRequesting] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);

  const cleanupStream = useCallback(() => {
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setPreviewReady(false);
  }, []);

  const attachStream = useCallback(async () => {
    setRequesting(true);
    const stream = await requestCameraStream();
    setRequesting(false);

    if (!stream) {
      setStatus('denied');
      return;
    }

    streamRef.current = stream;
    setStatus('granted');

    const playPreview = async (): Promise<boolean> => {
      const video = videoRef.current;
      if (!video) return false;
      video.srcObject = stream;
      try {
        await video.play();
        setPreviewReady(true);
        return true;
      } catch {
        return false;
      }
    };

    if (await playPreview()) return;

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (await playPreview()) return;

    setPreviewReady(false);
    setStatus('denied');
    cleanupStream();
  }, [cleanupStream]);

  useEffect(() => {
    if (!open) {
      cleanupStream();
      setStatus('checking');
      setRequesting(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      const permission = await queryCameraPermission();
      if (cancelled) return;

      setStatus(permission);
      if (permission === 'granted') {
        await attachStream();
      }
    })();

    return () => {
      cancelled = true;
      cleanupStream();
    };
  }, [open, attachStream, cleanupStream]);

  const handleAllow = () => {
    void attachStream();
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !previewReady) return;

    try {
      const dataUrl = captureVideoFrameToSquareDataUrl(video);
      cleanupStream();
      onCapture(dataUrl);
    } catch {
      setStatus('denied');
    }
  };

  const handleClose = () => {
    cleanupStream();
    onClose();
  };

  if (!open) return null;

  const isChecking = status === 'checking';
  const isDenied = status === 'denied';
  const isUnsupported = status === 'unsupported';
  const showPreview = status === 'granted' && previewReady;

  return (
    <div className='patient-camera-modal-root' role='presentation'>
      <div className='patient-camera-modal-backdrop' aria-hidden onClick={handleClose} />
      <div
        className='patient-camera-modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='patient-camera-modal-title'
        aria-describedby='patient-camera-modal-desc'
      >
        <button
          type='button'
          className='patient-camera-modal__close icon-btn'
          onClick={handleClose}
          aria-label='Close camera'
        >
          <X size={20} />
        </button>

        <div className='patient-camera-modal__icon' aria-hidden>
          {isUnsupported || isDenied ? <CameraOff size={28} /> : <Camera size={28} />}
        </div>

        <h2 id='patient-camera-modal-title' className='patient-camera-modal__title'>
          {showPreview
            ? 'Take your profile photo'
            : isUnsupported
              ? 'Camera not available'
              : isDenied
                ? 'Camera access blocked'
                : 'Allow camera access'}
        </h2>

        <p id='patient-camera-modal-desc' className='patient-camera-modal__desc muted'>
          {showPreview
            ? 'Position your face in the frame, then tap Capture photo.'
            : isChecking
              ? 'Checking camera permission…'
              : isUnsupported
                ? 'This browser does not support the camera. Use Upload photo instead.'
                : isDenied
                  ? 'Profile photos need camera access. Enable the camera for this site in your browser settings, then tap Try again.'
                  : 'Allow camera access so you can take a profile photo.'}
        </p>

        <div
          className={`patient-camera-modal__video-wrap${showPreview ? '' : ' patient-camera-modal__video-wrap--hidden'}`}
        >
          <video
            ref={videoRef}
            className='patient-camera-modal__video'
            playsInline
            muted
            autoPlay
            aria-label='Camera preview'
          />
        </div>

        {isChecking ? (
          <p className='doctor-status patient-camera-modal__checking'>
            <Loader2 size={18} className='spin' aria-hidden /> Preparing…
          </p>
        ) : (
          <div className='patient-camera-modal__actions'>
            {showPreview ? (
              <button type='button' className='primary-btn' onClick={handleCapture}>
                <Camera size={16} aria-hidden /> Capture photo
              </button>
            ) : !isUnsupported ? (
              <button
                type='button'
                className='primary-btn patient-camera-modal__allow'
                onClick={handleAllow}
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
                    <Camera size={16} aria-hidden /> Allow camera
                  </>
                )}
              </button>
            ) : null}

            <button type='button' className='secondary-btn' onClick={handleClose} disabled={requesting}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

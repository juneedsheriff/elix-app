import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CameraOff, Loader2, ShieldAlert, SwitchCamera, X } from 'lucide-react';
import { captureVideoFrameToDataUrl, captureVideoFrameToSquareDataUrl } from '../../lib/imageFiles';
import {
  isMobileOrTabletDevice,
  queryCameraPermission,
  requestCameraStream,
  stopMediaStream,
  type CameraFacingMode,
  type CameraPermissionStatus
} from '../../lib/cameraPermission';

type PatientCameraCaptureModalProps = {
  open: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
  mode?: 'profile' | 'document';
};

export default function PatientCameraCaptureModal({
  open,
  onClose,
  onCapture,
  mode = 'profile'
}: PatientCameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraPermissionStatus>('checking');
  const [requesting, setRequesting] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const facingModeRef = useRef<CameraFacingMode>('user');
  const [facingMode, setFacingMode] = useState<CameraFacingMode>('user');
  const canSwitchCamera = useMemo(() => isMobileOrTabletDevice(), []);

  const cleanupStream = useCallback(() => {
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setPreviewReady(false);
  }, []);

  const attachStream = useCallback(
    async (nextFacingMode: CameraFacingMode) => {
      setRequesting(true);
      const stream = await requestCameraStream(nextFacingMode);
      setRequesting(false);

      if (!stream) {
        setStatus('denied');
        return;
      }

      streamRef.current = stream;
      facingModeRef.current = nextFacingMode;
      setFacingMode(nextFacingMode);
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
    },
    [cleanupStream]
  );

  const switchCamera = useCallback(() => {
    const nextFacingMode: CameraFacingMode =
      facingModeRef.current === 'user' ? 'environment' : 'user';
    cleanupStream();
    void attachStream(nextFacingMode);
  }, [attachStream, cleanupStream]);

  useEffect(() => {
    if (!open) {
      cleanupStream();
      setStatus('checking');
      setRequesting(false);
      setFacingMode('user');
      facingModeRef.current = 'user';
      return;
    }

    let cancelled = false;

    void (async () => {
      const permission = await queryCameraPermission();
      if (cancelled) return;

      setStatus(permission);
      if (permission === 'granted') {
        await attachStream('user');
      }
    })();

    return () => {
      cancelled = true;
      cleanupStream();
    };
  }, [open, attachStream, cleanupStream]);

  const handleAllow = () => {
    void attachStream(facingModeRef.current);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !previewReady) return;

    try {
      const dataUrl =
        mode === 'document'
          ? captureVideoFrameToDataUrl(video)
          : captureVideoFrameToSquareDataUrl(video);
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
  const isDocumentMode = mode === 'document';

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
            ? isDocumentMode
              ? 'Capture consultation notes'
              : 'Take your profile photo'
            : isUnsupported
              ? 'Camera not available'
              : isDenied
                ? 'Camera access blocked'
                : 'Allow camera access'}
        </h2>

        <p id='patient-camera-modal-desc' className='patient-camera-modal__desc muted'>
          {showPreview
            ? isDocumentMode
              ? 'Point the camera at your notes, then tap Capture photo.'
              : facingMode === 'environment'
                ? 'Frame your photo with the rear camera, then tap Capture photo.'
                : 'Position your face in the frame, then tap Capture photo.'
            : isChecking
              ? 'Checking camera permission…'
              : isUnsupported
                ? 'This browser does not support the camera. Use Upload file instead.'
                : isDenied
                  ? isDocumentMode
                    ? 'Camera access is needed to photograph notes. Enable the camera for this site in your browser settings, then tap Try again.'
                    : 'Profile photos need camera access. Enable the camera for this site in your browser settings, then tap Try again.'
                  : isDocumentMode
                    ? 'Allow camera access so you can photograph consultation notes.'
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
              <>
                {canSwitchCamera ? (
                  <button
                    type='button'
                    className='secondary-btn patient-camera-modal__switch'
                    onClick={switchCamera}
                    disabled={requesting}
                  >
                    {requesting ? (
                      <>
                        <Loader2 size={16} className='spin' aria-hidden /> Switching camera…
                      </>
                    ) : (
                      <>
                        <SwitchCamera size={16} aria-hidden />
                        {facingMode === 'user' ? 'Use rear camera' : 'Use front camera'}
                      </>
                    )}
                  </button>
                ) : null}
                <button type='button' className='primary-btn' onClick={handleCapture} disabled={requesting}>
                  <Camera size={16} aria-hidden /> Capture photo
                </button>
              </>
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

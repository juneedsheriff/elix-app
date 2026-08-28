export type CameraPermissionStatus = 'checking' | 'prompt' | 'granted' | 'denied' | 'unsupported';

export type CameraFacingMode = 'user' | 'environment';

export function isCameraApiAvailable(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

/** True on phones and tablets where front/rear cameras are typically available. */
export function isMobileOrTabletDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }
  // iPadOS 13+ may report as Mac with touch.
  return navigator.maxTouchPoints > 1 && /MacIntel|Macintosh/.test(navigator.platform);
}

export async function queryCameraPermission(): Promise<CameraPermissionStatus> {
  if (!isCameraApiAvailable()) {
    return 'unsupported';
  }

  try {
    if (navigator.permissions?.query) {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      if (result.state === 'granted') return 'granted';
      if (result.state === 'denied') return 'denied';
      return 'prompt';
    }
  } catch {
    /* Permissions API for camera is not available in every browser */
  }

  return 'prompt';
}

export async function requestCameraStream(
  facingMode: CameraFacingMode = 'user'
): Promise<MediaStream | null> {
  if (!isCameraApiAvailable()) {
    return null;
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 1280 }
      },
      audio: false
    });
  } catch {
    if (facingMode === 'environment') {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 1280 },
            height: { ideal: 1280 }
          },
          audio: false
        });
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function stopMediaStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

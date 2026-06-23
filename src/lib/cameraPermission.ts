export type CameraPermissionStatus = 'checking' | 'prompt' | 'granted' | 'denied' | 'unsupported';

export function isCameraApiAvailable(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
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

export async function requestCameraStream(): Promise<MediaStream | null> {
  if (!isCameraApiAvailable()) {
    return null;
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 1280 }
      },
      audio: false
    });
  } catch {
    return null;
  }
}

export function stopMediaStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

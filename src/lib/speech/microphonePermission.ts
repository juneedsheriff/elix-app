export type MicrophonePermissionStatus = 'checking' | 'prompt' | 'granted' | 'denied' | 'unsupported';

export function isMicrophoneApiAvailable(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

export async function queryMicrophonePermission(): Promise<MicrophonePermissionStatus> {
  if (!isMicrophoneApiAvailable()) {
    return 'unsupported';
  }

  try {
    if (navigator.permissions?.query) {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (result.state === 'granted') return 'granted';
      if (result.state === 'denied') return 'denied';
      return 'prompt';
    }
  } catch {
    /* Permissions API for microphone is not available in every browser */
  }

  return 'prompt';
}

export async function requestMicrophonePermission(): Promise<'granted' | 'denied'> {
  if (!isMicrophoneApiAvailable()) {
    return 'denied';
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return 'granted';
  } catch {
    return 'denied';
  }
}

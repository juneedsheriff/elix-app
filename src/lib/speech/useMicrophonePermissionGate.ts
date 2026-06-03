import { useCallback, useEffect, useState } from 'react';
import {
  queryMicrophonePermission,
  requestMicrophonePermission,
  type MicrophonePermissionStatus
} from './microphonePermission';

export function useMicrophonePermissionGate(enabled: boolean) {
  const [status, setStatus] = useState<MicrophonePermissionStatus>('checking');
  const [requesting, setRequesting] = useState(false);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    void (async () => {
      const initial = await queryMicrophonePermission();
      if (!cancelled) {
        setStatus(initial);
      }
    })();

    let permissionStatus: PermissionStatus | null = null;

    void (async () => {
      try {
        if (!navigator.permissions?.query) return;
        permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        permissionStatus.onchange = () => {
          if (cancelled) return;
          if (permissionStatus?.state === 'granted') {
            setStatus('granted');
          } else if (permissionStatus?.state === 'denied') {
            setStatus('denied');
          } else {
            setStatus('prompt');
          }
        };
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || skipped || status !== 'prompt') return;

    let cancelled = false;

    void (async () => {
      const result = await requestMicrophonePermission();
      if (!cancelled && result === 'granted') {
        setStatus('granted');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, skipped, status]);

  const requestAccess = useCallback(async () => {
    setRequesting(true);
    const result = await requestMicrophonePermission();
    setStatus(result);
    setRequesting(false);
    return result;
  }, []);

  const skip = useCallback(() => {
    setSkipped(true);
  }, []);

  const gateActive = enabled && !skipped && status !== 'granted';

  return {
    status,
    requesting,
    gateActive,
    micGranted: status === 'granted',
    requestAccess,
    skip
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConsultationSummaryFieldKey } from '../consultationSummaryFields';
import { composeLiveTranscript } from './previewDictationText';
import {
  isMobileSpeechDevice,
  normalizeSpeechTranscript,
  readSegmentFromResults
} from './speechTranscriptMerge';
import { createSpeechRecognition, isSpeechRecognitionSupported } from './speechRecognitionSupport';

type UseConsultationVoiceDictationOptions = {
  onDictated: (fieldKey: ConsultationSummaryFieldKey, rawTranscript: string) => void;
  lang?: string;
};

function joinCommittedSegments(prior: string, segment: string): string {
  return composeLiveTranscript(prior.trim(), segment.trim());
}

export function useConsultationVoiceDictation({
  onDictated,
  lang = 'en-US'
}: UseConsultationVoiceDictationOptions) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const activeFieldRef = useRef<ConsultationSummaryFieldKey | null>(null);
  const priorCommittedRef = useRef('');
  const segmentCommittedRef = useRef('');
  const sessionTranscriptRef = useRef('');
  const interimTextRef = useRef('');
  const restartingRef = useRef(false);
  const isMobileRef = useRef(isMobileSpeechDevice());

  const [activeField, setActiveField] = useState<ConsultationSummaryFieldKey | null>(null);
  const [sessionText, setSessionText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const supported = isSpeechRecognitionSupported();

  const syncTranscriptState = useCallback((committed: string, interim: string) => {
    const normalizedCommitted = normalizeSpeechTranscript(committed);
    const normalizedInterim = interim.trim();

    sessionTranscriptRef.current = normalizedCommitted;
    interimTextRef.current = normalizedInterim;
    setSessionText(normalizedCommitted);
    setInterimText(normalizedInterim);
  }, []);

  const resetTranscriptState = useCallback(() => {
    priorCommittedRef.current = '';
    segmentCommittedRef.current = '';
    sessionTranscriptRef.current = '';
    interimTextRef.current = '';
    restartingRef.current = false;
    setSessionText('');
    setInterimText('');
  }, []);

  const finalizeSession = useCallback(
    (field: ConsultationSummaryFieldKey | null) => {
      if (!field) return;

      const pending = normalizeSpeechTranscript(
        composeLiveTranscript(sessionTranscriptRef.current, interimTextRef.current)
      );

      resetTranscriptState();

      if (pending) {
        onDictated(field, pending);
      }
    },
    [onDictated, resetTranscriptState]
  );

  const stop = useCallback(
    (options?: { discard?: boolean }) => {
      const field = activeFieldRef.current;
      const recognition = recognitionRef.current;

      activeFieldRef.current = null;
      setActiveField(null);
      restartingRef.current = false;

      if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognitionRef.current = null;
        try {
          recognition.stop();
        } catch {
          /* already stopped */
        }
      }

      if (options?.discard) {
        resetTranscriptState();
        return;
      }

      persistSegmentToPrior();
      syncTranscriptState(priorCommittedRef.current, interimTextRef.current);

      finalizeSession(field);
    },
    [finalizeSession, persistSegmentToPrior, resetTranscriptState]
  );

  const persistSegmentToPrior = useCallback(() => {
    const segment = normalizeSpeechTranscript(segmentCommittedRef.current);
    if (!segment) return;

    priorCommittedRef.current = normalizeSpeechTranscript(
      joinCommittedSegments(priorCommittedRef.current, segment)
    );
    segmentCommittedRef.current = '';
  }, []);

  const start = useCallback(
    (fieldKey: ConsultationSummaryFieldKey) => {
      if (!supported) {
        setError('Voice input is not supported in this browser.');
        return;
      }

      if (activeFieldRef.current === fieldKey) {
        stop();
        return;
      }

      if (activeFieldRef.current) {
        stop();
      }

      const recognition = createSpeechRecognition();
      if (!recognition) {
        setError('Voice input is not available.');
        return;
      }

      setError(null);
      priorCommittedRef.current = '';
      segmentCommittedRef.current = '';
      restartingRef.current = false;
      syncTranscriptState('', '');

      activeFieldRef.current = fieldKey;
      setActiveField(fieldKey);

      recognition.continuous = !isMobileRef.current;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const { committed, interim } = readSegmentFromResults(event.results);
        segmentCommittedRef.current = committed;

        const mergedCommitted = normalizeSpeechTranscript(
          joinCommittedSegments(priorCommittedRef.current, committed)
        );

        syncTranscriptState(mergedCommitted, interim);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'aborted' || event.error === 'no-speech') return;

        setError(
          event.error === 'not-allowed'
            ? 'Microphone access was denied. Allow microphone permission and try again.'
            : 'Voice input failed. Try again or type manually.'
        );

        const failedField = activeFieldRef.current;
        activeFieldRef.current = null;
        setActiveField(null);
        restartingRef.current = false;

        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognitionRef.current = null;

        try {
          recognition.stop();
        } catch {
          /* ignore */
        }

        finalizeSession(failedField);
      };

      recognition.onend = () => {
        if (!activeFieldRef.current || !recognitionRef.current || restartingRef.current) return;

        persistSegmentToPrior();
        syncTranscriptState(priorCommittedRef.current, '');

        if (isMobileRef.current) {
          return;
        }

        restartingRef.current = true;

        window.setTimeout(() => {
          if (!activeFieldRef.current || !recognitionRef.current) {
            restartingRef.current = false;
            return;
          }

          try {
            recognition.start();
          } catch {
            /* ignore restart errors */
          } finally {
            restartingRef.current = false;
          }
        }, 120);
      };

      recognitionRef.current = recognition;

      try {
        recognition.start();
      } catch {
        setError('Could not start voice input. Try again.');
        activeFieldRef.current = null;
        setActiveField(null);
        recognitionRef.current = null;
      }
    },
    [finalizeSession, lang, persistSegmentToPrior, stop, supported, syncTranscriptState]
  );

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      if (!recognition) return;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return {
    supported,
    activeField,
    sessionText,
    interimText,
    error,
    start,
    stop
  };
}

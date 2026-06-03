import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConsultationSummaryFieldKey } from '../consultationSummaryFields';
import { composeLiveTranscript } from './previewDictationText';
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
  /** Finals from completed recognition segments (before auto-restart). */
  const priorCommittedRef = useRef('');
  /** Finals accumulated in the current recognition segment. */
  const segmentCommittedRef = useRef('');
  const sessionTranscriptRef = useRef('');
  const interimTextRef = useRef('');

  const [activeField, setActiveField] = useState<ConsultationSummaryFieldKey | null>(null);
  const [sessionText, setSessionText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const supported = isSpeechRecognitionSupported();

  const syncTranscriptState = useCallback((committed: string, interim: string) => {
    sessionTranscriptRef.current = committed;
    interimTextRef.current = interim;
    setSessionText(committed);
    setInterimText(interim);
  }, []);

  const resetTranscriptState = useCallback(() => {
    priorCommittedRef.current = '';
    segmentCommittedRef.current = '';
    sessionTranscriptRef.current = '';
    interimTextRef.current = '';
    setSessionText('');
    setInterimText('');
  }, []);

  const finalizeSession = useCallback(
    (field: ConsultationSummaryFieldKey | null) => {
      if (!field) return;

      const pending = composeLiveTranscript(
        sessionTranscriptRef.current,
        interimTextRef.current
      ).trim();

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

      finalizeSession(field);
    },
    [finalizeSession, resetTranscriptState]
  );

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
      syncTranscriptState('', '');

      activeFieldRef.current = fieldKey;
      setActiveField(fieldKey);

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = result[0]?.transcript ?? '';
          if (!transcript) continue;

          if (result.isFinal) {
            segmentCommittedRef.current += transcript;
          } else {
            interim += transcript;
          }
        }

        const committed = joinCommittedSegments(
          priorCommittedRef.current,
          segmentCommittedRef.current.trim()
        );

        syncTranscriptState(committed, interim.trim());
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
        if (!activeFieldRef.current || !recognitionRef.current) return;

        priorCommittedRef.current = joinCommittedSegments(
          priorCommittedRef.current,
          segmentCommittedRef.current.trim()
        );
        segmentCommittedRef.current = '';
        syncTranscriptState(priorCommittedRef.current, '');

        try {
          recognition.start();
        } catch {
          /* ignore restart errors */
        }
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
    [finalizeSession, lang, stop, supported, syncTranscriptState]
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

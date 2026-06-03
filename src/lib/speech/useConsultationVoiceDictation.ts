import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConsultationSummaryFieldKey } from '../consultationSummaryFields';
import { createSpeechRecognition, isSpeechRecognitionSupported } from './speechRecognitionSupport';

type UseConsultationVoiceDictationOptions = {
  onDictated: (fieldKey: ConsultationSummaryFieldKey, rawTranscript: string) => void;
  lang?: string;
};

export function useConsultationVoiceDictation({
  onDictated,
  lang = 'en-US'
}: UseConsultationVoiceDictationOptions) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const activeFieldRef = useRef<ConsultationSummaryFieldKey | null>(null);
  const sessionTranscriptRef = useRef('');
  const interimTextRef = useRef('');

  const [activeField, setActiveField] = useState<ConsultationSummaryFieldKey | null>(null);
  const [sessionText, setSessionText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const supported = isSpeechRecognitionSupported();

  const finalizeSession = useCallback(
    (field: ConsultationSummaryFieldKey | null) => {
      if (!field) return;

      const pending = `${sessionTranscriptRef.current} ${interimTextRef.current}`.trim();
      sessionTranscriptRef.current = '';
      interimTextRef.current = '';
      setSessionText('');
      setInterimText('');

      if (pending) {
        onDictated(field, pending);
      }
    },
    [onDictated]
  );

  const stop = useCallback(() => {
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

    finalizeSession(field);
  }, [finalizeSession]);

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
      sessionTranscriptRef.current = '';
      interimTextRef.current = '';
      setSessionText('');
      setInterimText('');
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
          if (result.isFinal) {
            sessionTranscriptRef.current = `${sessionTranscriptRef.current} ${transcript}`.trim();
            setSessionText(sessionTranscriptRef.current);
          } else {
            interim = `${interim} ${transcript}`.trim();
          }
        }
        interimTextRef.current = interim;
        setInterimText(interim);
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
        sessionTranscriptRef.current = '';
        interimTextRef.current = '';
        setSessionText('');
        setInterimText('');

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
        if (activeFieldRef.current && recognitionRef.current) {
          try {
            recognition.start();
          } catch {
            /* ignore restart errors */
          }
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
    [finalizeSession, lang, stop, supported]
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

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}

export function createSpeechRecognition(): SpeechRecognition | null {
  if (typeof window === 'undefined') return null;

  const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) return null;

  return new SpeechRecognitionCtor();
}

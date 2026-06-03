export function isMobileSpeechDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Mobile speech engines often emit duplicate or cumulative final hypotheses for one utterance.
 * Collapse those into a single committed segment.
 */
export function mergeFinalTranscripts(finals: string[]): string {
  const trimmed = finals.map((entry) => entry.trim()).filter(Boolean);
  if (!trimmed.length) return '';

  const firstLower = trimmed[0].toLowerCase();
  if (trimmed.every((entry) => entry.toLowerCase() === firstLower)) {
    return trimmed[0];
  }

  let cumulative = true;
  for (let index = 1; index < trimmed.length; index += 1) {
    const previous = trimmed[index - 1].toLowerCase();
    const current = trimmed[index].toLowerCase();
    if (current !== previous && !current.startsWith(previous)) {
      cumulative = false;
      break;
    }
  }
  if (cumulative) {
    return trimmed[trimmed.length - 1];
  }

  const parts: string[] = [];
  for (const entry of trimmed) {
    const lower = entry.toLowerCase();
    const last = parts[parts.length - 1];
    if (last && last.toLowerCase() === lower) continue;
    parts.push(entry);
  }

  return parts.join(' ');
}

export function readSegmentFromResults(results: SpeechRecognitionResultList): {
  committed: string;
  interim: string;
} {
  const finals: string[] = [];
  let interim = '';

  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const transcript = result[0]?.transcript ?? '';
    if (!transcript.trim()) continue;

    if (result.isFinal) {
      finals.push(transcript);
    } else {
      interim += transcript;
    }
  }

  return {
    committed: mergeFinalTranscripts(finals),
    interim: interim.trim()
  };
}

/** Collapse stuttered repeats like "hi hi hi" → "hi". */
export function collapseConsecutiveDuplicateWords(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return text.trim();

  return words
    .filter((word, index) => index === 0 || word.toLowerCase() !== words[index - 1].toLowerCase())
    .join(' ');
}

export function normalizeSpeechTranscript(text: string): string {
  return collapseConsecutiveDuplicateWords(text.replace(/\s+/g, ' ').trim());
}

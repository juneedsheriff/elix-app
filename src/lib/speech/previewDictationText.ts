/**
 * Live dictation display: committed finals plus in-progress interim.
 * Interim is the current non-final hypothesis — not appended separately when
 * it duplicates text already in committed finals.
 */
export function composeLiveTranscript(committed: string, interim: string): string {
  const finals = committed.trim();
  const pending = interim.trim();

  if (!pending) return finals;
  if (!finals) return pending;

  const finalsLower = finals.toLowerCase();
  const pendingLower = pending.toLowerCase();

  if (finalsLower.endsWith(pendingLower)) {
    return finals;
  }

  const needsSpace = /[a-z0-9]$/i.test(finals) && /^[a-z0-9]/i.test(pending);
  return needsSpace ? `${finals} ${pending}` : `${finals}${pending}`;
}

export function previewDictationText(existing: string, session: string, interim: string): string {
  const live = composeLiveTranscript(session, interim);
  if (!live) return existing;
  if (!existing.trim()) return live;

  const separator = existing.endsWith('\n') ? '' : '\n';
  return `${existing.trimEnd()}${separator}${live}`;
}

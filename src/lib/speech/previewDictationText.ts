export function previewDictationText(existing: string, session: string, interim: string): string {
  const draft = `${session} ${interim}`.trim();
  if (!draft) return existing;
  if (!existing.trim()) return draft;
  const separator = existing.endsWith('\n') ? '' : '\n';
  return `${existing.trimEnd()}${separator}${draft}`;
}

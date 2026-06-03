import type { ConsultationSummaryFieldKey } from '../consultationSummaryFields';
import { normalizeSpeechTranscript } from './speechTranscriptMerge';

function normalizeSpokenPunctuation(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\b(comma)\b/gi, ',')
    .replace(/\b(period|full stop)\b/gi, '.')
    .replace(/\b(question mark)\b/gi, '?')
    .replace(/\b(colon)\b/gi, ':')
    .replace(/\b(semicolon)\b/gi, ';')
    .replace(/\b(new line|next line|line break)\b/gi, '\n')
    .replace(/\b(bullet point|bullet|new item)\b/gi, '\n• ')
    .replace(/\s+([,.;:?])/g, '$1')
    .replace(/([,.;:?])([^\s\n])/g, '$1 $2')
    .trim();
}

function capitalizeSentences(text: string): string {
  return text.replace(/(^\s*|[.!?]\s+|\n+\s*)([a-z])/g, (_, prefix, letter: string) => {
    return `${prefix}${letter.toUpperCase()}`;
  });
}

function formatMedicationList(text: string): string {
  const normalized = normalizeSpokenPunctuation(text);
  const parts = normalized
    .split(/\n|(?:,\s*)|\s+and\s+/i)
    .map((part) => part.trim().replace(/^•\s*/, ''))
    .filter(Boolean);

  if (parts.length <= 1) {
    return capitalizeSentences(normalized);
  }

  return parts.map((part) => `• ${capitalizeSentences(part)}`).join('\n');
}

function formatVitalSigns(text: string): string {
  let formatted = normalizeSpokenPunctuation(text)
    .replace(/\bb p\b/gi, 'BP')
    .replace(/\bblood pressure\b/gi, 'BP')
    .replace(/\bheart rate\b/gi, 'HR')
    .replace(/\btemp(?:erature)?\b/gi, 'Temp')
    .replace(/\bresp(?:iratory)? rate\b/gi, 'RR')
    .replace(/\bs p o 2\b|\bspo2\b/gi, 'SpO2')
    .replace(/(\d+)\s+over\s+(\d+)/gi, '$1/$2');

  return capitalizeSentences(formatted);
}

function formatPrescription(text: string): string {
  const normalized = normalizeSpokenPunctuation(text);
  const lines = normalized
    .split(/\n|(?:,\s*)|\s+and\s+/i)
    .map((line) => line.trim().replace(/^\d+\.\s*/, ''))
    .filter(Boolean);

  if (lines.length <= 1) {
    return capitalizeSentences(normalized);
  }

  return lines.map((line, index) => `${index + 1}. ${capitalizeSentences(line)}`).join('\n');
}

function formatLabs(text: string): string {
  const normalized = normalizeSpokenPunctuation(text);
  if (normalized.includes('\n') || normalized.includes('•')) {
    return capitalizeSentences(normalized);
  }

  const parts = normalized.split(/\s*,\s*|\s+and\s+/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return capitalizeSentences(normalized);
  }

  return parts.map((part) => `• ${capitalizeSentences(part)}`).join('\n');
}

export function formatDictatedClinicalText(
  raw: string,
  fieldKey: ConsultationSummaryFieldKey
): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  switch (fieldKey) {
    case 'vital_signs':
      return formatVitalSigns(trimmed);
    case 'current_medications':
      return formatMedicationList(trimmed);
    case 'prescription':
      return formatPrescription(trimmed);
    case 'labs_diagnostics':
      return formatLabs(trimmed);
    default:
      return capitalizeSentences(normalizeSpokenPunctuation(trimmed));
  }
}

export function mergeDictatedFieldText(
  existing: string,
  dictatedRaw: string,
  fieldKey: ConsultationSummaryFieldKey
): string {
  const formatted = formatDictatedClinicalText(normalizeSpeechTranscript(dictatedRaw), fieldKey);
  if (!formatted) return existing;
  if (!existing.trim()) return formatted;

  const separator = existing.endsWith('\n') ? '' : '\n';
  return `${existing.trimEnd()}${separator}${formatted}`;
}

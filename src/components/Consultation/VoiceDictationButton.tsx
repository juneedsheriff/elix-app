import { Mic, Square } from 'lucide-react';

type VoiceDictationButtonProps = {
  active: boolean;
  supported: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
};

export default function VoiceDictationButton({
  active,
  supported,
  disabled = false,
  label,
  onClick
}: VoiceDictationButtonProps) {
  const title = !supported
    ? 'Voice input is not supported in this browser'
    : active
      ? `Stop recording for ${label}`
      : `Record ${label} by voice`;

  return (
    <button
      type='button'
      className={`voice-dictation-btn ${active ? 'voice-dictation-btn--active' : ''}`}
      onClick={onClick}
      disabled={disabled || !supported}
      aria-pressed={active}
      aria-label={title}
      title={title}
    >
      {active ? <Square size={14} aria-hidden /> : <Mic size={16} aria-hidden />}
      <span>{active ? 'Stop' : 'Voice'}</span>
    </button>
  );
}

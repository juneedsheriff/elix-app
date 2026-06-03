import { FileImage, FileText, FileType } from 'lucide-react';

export type RecordFileIconType = 'pdf' | 'jpg' | 'doc' | 'docx' | 'default';

export function recordFileIconType(fileName: string): RecordFileIconType {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
  if (ext === 'docx') return 'docx';
  if (ext === 'doc') return 'doc';
  return 'default';
}

export function recordFileIconTypeFromPill(pill: 'PDF' | 'JPG' | 'DOC' | 'DOCX'): RecordFileIconType {
  return pill === 'PDF' ? 'pdf' : pill === 'JPG' ? 'jpg' : pill === 'DOCX' ? 'docx' : 'doc';
}

type RecordFileTypeIconProps = {
  type: RecordFileIconType;
  size?: 'sm' | 'lg';
  className?: string;
};

function Glyph({ type, size }: { type: RecordFileIconType; size: 'sm' | 'lg' }) {
  const iconSize = size === 'lg' ? 22 : 13;
  const stroke = size === 'lg' ? 2 : 2.25;

  switch (type) {
    case 'pdf':
      return <FileText size={iconSize} strokeWidth={stroke} aria-hidden />;
    case 'jpg':
      return <FileImage size={iconSize} strokeWidth={stroke} aria-hidden />;
    case 'doc':
      return <FileText size={iconSize} strokeWidth={stroke} aria-hidden />;
    case 'docx':
      return <FileType size={iconSize} strokeWidth={stroke} aria-hidden />;
    default:
      return <FileText size={iconSize} strokeWidth={stroke} aria-hidden />;
  }
}

export default function RecordFileTypeIcon({
  type,
  size = 'lg',
  className = ''
}: RecordFileTypeIconProps) {
  return (
    <span
      className={`urv-type-icon urv-type-icon--${type} urv-type-icon--${size} ${className}`.trim()}
      aria-hidden
    >
      <Glyph type={type} size={size} />
    </span>
  );
}

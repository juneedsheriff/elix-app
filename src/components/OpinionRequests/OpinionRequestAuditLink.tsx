import { History } from 'lucide-react';
import './patient-my-requests.css';

type OpinionRequestAuditLinkProps = {
  onOpen: () => void;
  buttonClassName?: string;
  buttonLabel?: string;
};

export default function OpinionRequestAuditLink({
  onOpen,
  buttonClassName = 'pmr-audit-btn',
  buttonLabel = 'View activity'
}: OpinionRequestAuditLinkProps) {
  return (
    <button type='button' className={buttonClassName} onClick={onOpen}>
      <History size={16} aria-hidden />
      {buttonLabel}
    </button>
  );
}

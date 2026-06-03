import { ClipboardPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { doctorConsultationButtonLabel } from '../../lib/doctorConsultation';
import { appScreenPath } from '../../lib/navigation/appRoutes';
import { openDoctorConsultation } from '../../lib/navigation/doctorConsultationNav';
import type { OpinionRequest } from '../../types/opinionRequest';

type DoctorGiveConsultationButtonProps = {
  request: OpinionRequest;
  onNavigate?: (screenId: string) => void;
  returnScreen?: string;
};

export default function DoctorGiveConsultationButton({
  request,
  onNavigate,
  returnScreen = 'case-review'
}: DoctorGiveConsultationButtonProps) {
  const routerNavigate = useNavigate();

  const navigateToScreen = (screenId: string) => {
    if (onNavigate) {
      onNavigate(screenId);
      return;
    }
    routerNavigate(appScreenPath(screenId));
  };

  return (
    <button
      type='button'
      className='primary-btn doctor-respond-cta'
      onClick={() => openDoctorConsultation(request.id, navigateToScreen, returnScreen)}
    >
      <ClipboardPlus size={18} aria-hidden />
      {doctorConsultationButtonLabel(request)}
    </button>
  );
}

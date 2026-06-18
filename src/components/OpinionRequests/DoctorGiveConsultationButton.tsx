import { Button } from '@mantine/core';
import { IconClipboardPlus } from '@tabler/icons-react';
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
  compact?: boolean;
};

export default function DoctorGiveConsultationButton({
  request,
  onNavigate,
  returnScreen = 'case-review',
  compact = false
}: DoctorGiveConsultationButtonProps) {
  const routerNavigate = useNavigate();

  const navigateToScreen = (screenId: string) => {
    if (onNavigate) {
      onNavigate(screenId);
      return;
    }
    routerNavigate(appScreenPath(screenId));
  };

  const handleClick = () => openDoctorConsultation(request.id, navigateToScreen, returnScreen);

  if (compact) {
    return (
      <Button
        size='compact-sm'
        radius='xl'
        color='cyan'
        leftSection={<IconClipboardPlus size={15} stroke={1.6} />}
        onClick={handleClick}
        className='doctor-cases-table-action'
      >
        {doctorConsultationButtonLabel(request)}
      </Button>
    );
  }

  return (
    <button type='button' className='primary-btn doctor-respond-cta' onClick={handleClick}>      <ClipboardPlus size={18} aria-hidden />
      {doctorConsultationButtonLabel(request)}
    </button>
  );
}

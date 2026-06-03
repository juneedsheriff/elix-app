import DoctorGiveConsultationButton from './DoctorGiveConsultationButton';
import type { OpinionRequest } from '../../types/opinionRequest';

type DoctorConsultationSummaryFormProps = {
  request: OpinionRequest;
  onNavigate: (screenId: string) => void;
  returnScreen?: string;
};

/** @deprecated Use DoctorGiveConsultationButton — kept for imports. */
export default function DoctorConsultationSummaryForm(props: DoctorConsultationSummaryFormProps) {
  return (
    <div className='doctor-request-respond'>
      <DoctorGiveConsultationButton {...props} />
    </div>
  );
}

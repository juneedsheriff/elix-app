import PatientConsultationWizard from '../ConsultationWorkflow/PatientConsultationWizard';
import type { OpinionRequest } from '../../types/opinionRequest';

type ConsultationPatientWorkflowProps = {
  request: OpinionRequest;
  onUpdated: () => void;
  onMessage: (message: string, type: 'error' | 'success') => void;
  onOpenRecord: (storagePath: string) => void;
  liveTick?: number;
};

export default function ConsultationPatientWorkflow(props: ConsultationPatientWorkflowProps) {
  return <PatientConsultationWizard {...props} />;
}

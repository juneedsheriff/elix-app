import { useCallback } from 'react';
import { openMedicalRecordByPath } from '../../lib/records';
import type { OpinionRequest } from '../../types/opinionRequest';
import PatientCaseDetailsReadOnlyView from './PatientCaseDetailsReadOnlyView';
import RequestRecordsGallery from './RequestRecordsGallery';

type DoctorPatientCaseDetailsSectionsProps = {
  request: OpinionRequest;
  onOpenError?: (message: string) => void;
  lightboxModalZIndex?: number;
  className?: string;
};

export default function DoctorPatientCaseDetailsSections({
  request,
  onOpenError,
  lightboxModalZIndex = 1000,
  className = ''
}: DoctorPatientCaseDetailsSectionsProps) {
  const openDocument = useCallback(
    async (storagePath: string, requestId: string) => {
      const { error } = await openMedicalRecordByPath(storagePath, { requestId });
      if (error) {
        onOpenError?.(error.message);
      }
    },
    [onOpenError]
  );

  const recordsKey = request.records.map((record) => record.id).join(',');

  return (
    <div className={`doctor-patient-case-details-sections${className ? ` ${className}` : ''}`}>
      <section className='doctor-patient-case-details-sections__section' aria-label='Case information'>
        <h3 className='doctor-patient-case-details-sections__section-title'>Case information</h3>
        <PatientCaseDetailsReadOnlyView request={request} sectionsThrough={8} />
      </section>

      <section className='doctor-patient-case-details-sections__section' aria-label='Medical records'>
        <div className='doctor-patient-case-details-sections__section-head'>
          <h3 className='doctor-patient-case-details-sections__section-title'>Medical records</h3>
          <span className='doctor-patient-case-details-sections__records-count'>
            {request.records.length} file{request.records.length === 1 ? '' : 's'}
          </span>
        </div>
        <RequestRecordsGallery
          key={recordsKey}
          records={request.records}
          requestId={request.id}
          onOpenDocument={(path, requestId) => void openDocument(path, requestId)}
          lightboxModalZIndex={lightboxModalZIndex}
        />
      </section>
    </div>
  );
}

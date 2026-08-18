import { useCallback, useEffect, useState } from 'react';
import {
  avatarColorFromName,
  displayInitials,
  resolveProfilePhotoUrl
} from '../../lib/avatarDisplay';
import { openMedicalRecordByPath } from '../../lib/records';
import { fetchPatientByAuthUserId } from '../../lib/patients';
import type { OpinionRequest } from '../../types/opinionRequest';
import type { Patient, PatientAttachedDocument } from '../../types/patient';
import PatientCaseDetailsReadOnlyView from './PatientCaseDetailsReadOnlyView';
import RequestRecordsGallery from './RequestRecordsGallery';
import './doctor-patient-case-details-sections.css';

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
  const [profile, setProfile] = useState<Patient | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (request.patient_id) {
        const { data } = await fetchPatientByAuthUserId(request.patient_id);
        if (!cancelled) setProfile(data);
        return;
      }
      setProfile(null);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [request.patient_id]);

  const openDocument = useCallback(
    async (storagePath: string, requestId?: string) => {
      const { error } = await openMedicalRecordByPath(storagePath, requestId ? { requestId } : undefined);
      if (error) {
        onOpenError?.(error.message);
      }
    },
    [onOpenError]
  );

  const prescriptions: PatientAttachedDocument[] =
    profile?.latest_prescription_documents ?? [];

  const recordsKey = request.records.map((record) => record.id).join(',');
  const patientName = profile?.full_name?.trim() || request.patient_name?.trim() || 'Patient';
  const patientPhotoUrl = resolveProfilePhotoUrl(profile?.avatar_url ?? request.patient_avatar_url);
  const patientInitials = displayInitials(patientName);
  const patientAvatarBg = avatarColorFromName(patientName);

  return (
    <div className={`doctor-patient-case-details-sections${className ? ` ${className}` : ''}`}>
      <section className='doctor-patient-case-details-sections__section' aria-label='Case information'>
        <div className='doctor-patient-case-details-sections__section-head'>
          <h3 className='doctor-patient-case-details-sections__section-title'>Patient case details</h3>
          {request.case_details_reviewed_at ? (
            <span className='doctor-patient-case-details-sections__reviewed-badge'>
              Reviewed {new Date(request.case_details_reviewed_at).toLocaleString()}
            </span>
          ) : null}
        </div>
        <div className='doctor-patient-case-details-sections__patient'>
          {patientPhotoUrl ? (
            <img
              src={patientPhotoUrl}
              alt=''
              className='doctor-patient-case-details-sections__patient-photo'
              width={100}
              height={100}
            />
          ) : (
            <span
              className='doctor-patient-case-details-sections__patient-initials'
              style={{ background: patientAvatarBg }}
              aria-hidden
            >
              {patientInitials}
            </span>
          )}
          <strong className='doctor-patient-case-details-sections__patient-name'>{patientName}</strong>
        </div>
        <p className='doctor-patient-case-details-sections__intro muted'>
          Case information submitted for this request (same details the care team reviews).
        </p>
        <PatientCaseDetailsReadOnlyView
          request={request}
          showCurrentHealthcareProvider={false}
          showConsultationQuestions={false}
        />
      </section>

      {profile?.current_medications?.trim() || prescriptions.length ? (
        <section
          className='doctor-patient-case-details-sections__section'
          aria-label='Current medications and prescriptions'
        >
          <h3 className='doctor-patient-case-details-sections__section-title'>
            Profile medications
          </h3>
          {profile?.current_medications?.trim() ? (
            <p className='doctor-patient-case-details-sections__meds'>
              {profile.current_medications.trim()}
            </p>
          ) : (
            <p className='muted'>No medication list on the patient profile.</p>
          )}
          {prescriptions.length ? (
            <div className='doctor-patient-case-details-sections__prescriptions'>
              <p className='doctor-patient-case-details-sections__subhead'>Latest prescriptions</p>
              <ul className='doctor-patient-case-details-sections__file-list'>
                {prescriptions.map((doc) => (
                  <li key={doc.id}>
                    <button
                      type='button'
                      className='doctor-patient-case-details-sections__file-link'
                      onClick={() => void openDocument(doc.storage_path, request.id)}
                    >
                      {doc.file_name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

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

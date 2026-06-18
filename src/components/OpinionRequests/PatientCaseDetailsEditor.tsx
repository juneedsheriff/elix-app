import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import PatientCaseDetailsForm from './PatientCaseDetailsForm';
import {
  caseDetailsFromRequest,
  emptyPatientCaseDetails,
  serializePatientCaseDetails,
  validatePatientCaseDetails
} from '../../lib/patientCaseDetails';
import { updatePatientCaseDetails, type SavedPatientCaseDetailsPatch } from '../../lib/opinionRequests';
import type { OpinionRequest } from '../../types/opinionRequest';
import type { PatientCaseDetails } from '../../types/patientCaseDetails';
import './patient-case-details-readonly.css';

type PatientCaseDetailsEditorProps = {
  request: OpinionRequest;
  specialties: string[];
  specialtyMode: 'patient_select' | 'from_doctor';
  doctorSpecialty?: string | null;
  actorRole: 'patient' | 'pse';
  showPreferences?: boolean;
  showConsent?: boolean;
  sectionsThrough?: 6 | 8;
  canMarkReviewed?: boolean;
  markReviewedBusy?: boolean;
  onMarkReviewed?: () => void;
  onSaved?: (patch: SavedPatientCaseDetailsPatch) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

export default function PatientCaseDetailsEditor({
  request,
  specialties,
  specialtyMode,
  doctorSpecialty,
  actorRole,
  showPreferences = false,
  showConsent = false,
  sectionsThrough = 8,
  canMarkReviewed = false,
  markReviewedBusy = false,
  onMarkReviewed,
  onSaved,
  onError,
  onSuccess
}: PatientCaseDetailsEditorProps) {
  const [caseDetails, setCaseDetails] = useState<PatientCaseDetails>(() =>
    caseDetailsFromRequest(request)
  );
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const syncedRemoteKeyRef = useRef<string | null>(null);

  const remoteCaseDetailsKey = JSON.stringify({
    patientCaseDetails: request.patient_case_details ?? null,
    message: request.message ?? '',
    requestedSpecialty: request.requested_specialty ?? '',
    caseDetailsReviewedAt: request.case_details_reviewed_at ?? null
  });

  useEffect(() => {
    if (savingRef.current) return;
    if (syncedRemoteKeyRef.current === remoteCaseDetailsKey) return;
    setCaseDetails(caseDetailsFromRequest(request));
    syncedRemoteKeyRef.current = remoteCaseDetailsKey;
  }, [request.id, remoteCaseDetailsKey, request]);

  const handleSave = async () => {
    const validationError = validatePatientCaseDetails(caseDetails, {
      requireConsent: showConsent,
      requireSpecialty: specialtyMode === 'patient_select'
    });
    if (validationError) {
      onError(validationError);
      return;
    }

    const nextDetails = emptyPatientCaseDetails({
      ...caseDetails,
      specialtyRequired:
        specialtyMode === 'from_doctor'
          ? doctorSpecialty ?? caseDetails.specialtyRequired
          : caseDetails.specialtyRequired
    });

    setSaving(true);
    savingRef.current = true;
    const { data, error } = await updatePatientCaseDetails(
      request.id,
      serializePatientCaseDetails(nextDetails),
      {
        actorRole,
        syncMessage: true,
        requestedSpecialty:
          specialtyMode === 'patient_select' ? nextDetails.specialtyRequired : undefined
      }
    );
    setSaving(false);
    savingRef.current = false;

    if (error) {
      onError(error.message);
      return;
    }

    if (!data) {
      onError('Case details could not be saved. Please try again.');
      return;
    }

    const savedRequest: OpinionRequest = {
      ...request,
      patient_case_details: data.patient_case_details ?? serializePatientCaseDetails(nextDetails),
      message: data.message ?? request.message,
      requested_specialty: data.requested_specialty ?? request.requested_specialty
    };
    const savedDetails = caseDetailsFromRequest(savedRequest);
    setCaseDetails(savedDetails);
    syncedRemoteKeyRef.current = JSON.stringify({
      patientCaseDetails: savedRequest.patient_case_details ?? null,
      message: savedRequest.message ?? '',
      requestedSpecialty: savedRequest.requested_specialty ?? '',
      caseDetailsReviewedAt: savedRequest.case_details_reviewed_at ?? null
    });

    onSuccess('Case details saved.');
    onSaved?.({
      patient_case_details: savedRequest.patient_case_details,
      message: savedRequest.message,
      requested_specialty: savedRequest.requested_specialty
    });
  };

  return (
    <div className='patient-case-details-editor'>
      <PatientCaseDetailsForm
        value={caseDetails}
        onChange={setCaseDetails}
        specialties={specialties}
        specialtyMode={specialtyMode}
        doctorSpecialty={doctorSpecialty}
        showPreferences={showPreferences}
        showConsent={showConsent}
        sectionsThrough={sectionsThrough}
      />

      <div className='patient-case-details-editor__actions'>
        <button
          type='button'
          className='primary-btn patient-case-details-editor__save'
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? (
            <>
              <Loader2 size={16} className='spin' aria-hidden /> Saving…
            </>
          ) : (
            'Save case details'
          )}
        </button>
        {canMarkReviewed && onMarkReviewed ? (
          request.case_details_reviewed_at ? (
            <p className='patient-case-details-editor__reviewed muted' role='status'>
              Reviewed {new Date(request.case_details_reviewed_at).toLocaleString()}
            </p>
          ) : (
            <button
              type='button'
              className='secondary-btn patient-case-details-editor__review'
              disabled={markReviewedBusy}
              onClick={onMarkReviewed}
            >
              {markReviewedBusy ? (
                <>
                  <Loader2 size={16} className='spin' aria-hidden /> Marking…
                </>
              ) : (
                'Mark Details as Reviewed'
              )}
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}

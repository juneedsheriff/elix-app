import {
  caseDetailsFromRequest,
  formatCaseDetailList,
  formatCaseDetailValue,
  formatPreferredTimeSlots
} from '../../lib/patientCaseDetails';
import type { OpinionRequest } from '../../types/opinionRequest';
import './patient-case-details-readonly.css';

type PatientCaseDetailsReadOnlyViewProps = {
  request: OpinionRequest;
  sectionsThrough?: 6 | 8;
};

function SectionHeading({ title }: { title: string }) {
  return <h5 className='patient-case-details-readonly__section'>{title}</h5>;
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className='patient-case-details-readonly__field'>
      <span className='patient-case-details-readonly__label'>{label}</span>
      <p className='patient-case-details-readonly__value'>{value}</p>
    </div>
  );
}

export default function PatientCaseDetailsReadOnlyView({
  request,
  sectionsThrough = 6
}: PatientCaseDetailsReadOnlyViewProps) {
  const details = caseDetailsFromRequest(request);
  const specialty =
    details.specialtyRequired ||
    request.requested_specialty ||
    request.doctor_specialty ||
    '';

  const reason =
    details.reasonForSecondOpinion === 'Other'
      ? formatCaseDetailValue(details.reasonForSecondOpinionOther || details.reasonForSecondOpinion)
      : formatCaseDetailValue(details.reasonForSecondOpinion);

  const questions = [
    ...details.questionCategories.filter((item) => item !== 'Other'),
    ...(details.questionCategories.includes('Other') && details.questionCategoriesOther
      ? [details.questionCategoriesOther]
      : [])
  ];

  return (
    <div className='patient-case-details-readonly'>
      <SectionHeading title='1. Consultation Details' />
      <div className='patient-case-details-readonly__grid'>
        <DetailField
          label='Primary Health Concern / Diagnosis'
          value={formatCaseDetailValue(details.primaryHealthConcern || request.message)}
        />
        <DetailField label='Specialty Required' value={formatCaseDetailValue(specialty)} />
        <DetailField label='Reason for Seeking a Doctor Consultation' value={reason} />
      </div>

      <SectionHeading title='2. Current Medical Condition' />
      <div className='patient-case-details-readonly__grid'>
        <DetailField
          label='Brief Description of Symptoms'
          value={formatCaseDetailValue(details.symptomsDescription)}
        />
        <DetailField
          label='Date Symptoms Started'
          value={formatCaseDetailValue(details.symptomsStartedDate)}
        />
        <DetailField label='Severity of Symptoms' value={formatCaseDetailValue(details.symptomSeverity)} />
        <p className='patient-case-details-readonly__subsection'>Vital Signs</p>
        <DetailField
          label='Blood Pressure'
          value={formatCaseDetailValue(details.vitalSigns.bloodPressure)}
        />
        <DetailField label='Pulse Rate' value={formatCaseDetailValue(details.vitalSigns.pulseRate)} />
        <DetailField
          label='Respiratory Rate'
          value={formatCaseDetailValue(details.vitalSigns.respiratoryRate)}
        />
        <DetailField
          label='Temperature'
          value={formatCaseDetailValue(details.vitalSigns.temperature)}
        />
        <DetailField label='SpO₂' value={formatCaseDetailValue(details.vitalSigns.spo2)} />
        <DetailField label='Height' value={formatCaseDetailValue(details.vitalSigns.height)} />
        <DetailField label='Weight' value={formatCaseDetailValue(details.vitalSigns.weight)} />
        <DetailField label='Current Diagnosis' value={formatCaseDetailValue(details.currentDiagnosis)} />
        <DetailField
          label='Current Treatment Plan'
          value={formatCaseDetailValue(details.currentTreatmentPlan)}
        />
      </div>

      <SectionHeading title='3. Medical History' />
      <div className='patient-case-details-readonly__grid'>
        <DetailField
          label='Medical History'
          value={formatCaseDetailValue(details.existingMedicalConditions)}
        />
        <DetailField label='Surgical History' value={formatCaseDetailValue(details.previousSurgeries)} />
        <DetailField label='Family History' value={formatCaseDetailValue(details.familyHistory)} />
        <DetailField label='Social History' value={formatCaseDetailValue(details.socialHistory)} />
        <DetailField label='Known Allergies' value={formatCaseDetailValue(details.knownAllergies)} />
        <DetailField
          label='Current Medications'
          value={formatCaseDetailValue(details.currentMedications)}
        />
      </div>

      <SectionHeading title='4. Current Healthcare Provider' />
      <div className='patient-case-details-readonly__grid'>
        <DetailField
          label='Treating Doctor Name'
          value={formatCaseDetailValue(details.treatingDoctorName)}
        />
        <DetailField
          label='Hospital / Clinic Name'
          value={formatCaseDetailValue(details.hospitalClinicName)}
        />
        <DetailField
          label='Specialty of Treating Doctor'
          value={formatCaseDetailValue(details.treatingDoctorSpecialty)}
        />
        <DetailField
          label='Date of Last Consultation'
          value={formatCaseDetailValue(details.lastConsultationDate)}
        />
      </div>

      <SectionHeading title='6. Questions for the Doctor Consultation' />
      <div className='patient-case-details-readonly__grid'>
        <DetailField
          label='What specific questions would you like answered?'
          value={formatCaseDetailList(questions)}
        />
        <DetailField
          label='Additional Questions or Concerns'
          value={formatCaseDetailValue(details.additionalQuestions)}
        />
      </div>

      {sectionsThrough >= 8 ? (
        <>
          <SectionHeading title='7. Consultation Preferences' />
          <div className='patient-case-details-readonly__grid'>
            <DetailField
              label='Preferred Consultation Mode'
              value={formatCaseDetailValue(details.preferredConsultationMode)}
            />
            <DetailField
              label='Preferred Language'
              value={formatCaseDetailList(details.preferredLanguages)}
            />
            <DetailField
              label='Preferred Time Slots'
              value={formatPreferredTimeSlots(details.preferredTimeSlots)}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

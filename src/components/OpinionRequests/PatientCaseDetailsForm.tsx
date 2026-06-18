import PreferredLanguageMultiSelect from '../patient/PreferredLanguageMultiSelect';
import PatientBirthDatePicker from '../patient/PatientBirthDatePicker';
import {
  CONSULTATION_MODE_OPTIONS,
  SECOND_OPINION_QUESTION_OPTIONS,
  SECOND_OPINION_REASON_OPTIONS,
  SYMPTOM_SEVERITY_OPTIONS,
  type PatientCaseDetails,
  type SecondOpinionQuestion
} from '../../types/patientCaseDetails';
import PreferredTimeSlotsPicker from './PreferredTimeSlotsPicker';
import './patient-case-details-form.css';

export type PatientCaseDetailsFormProps = {
  value: PatientCaseDetails;
  onChange: (value: PatientCaseDetails) => void;
  specialties: string[];
  specialtyMode: 'patient_select' | 'from_doctor';
  doctorSpecialty?: string | null;
  showPreferences?: boolean;
  showConsent?: boolean;
  /** When false, hides numbered sections 1–6 (used during initial request submission). */
  showCaseSections?: boolean;
  sectionsThrough?: 6 | 8;
  disabled?: boolean;
  readOnly?: boolean;
};

function patch(
  value: PatientCaseDetails,
  onChange: (value: PatientCaseDetails) => void,
  partial: Partial<PatientCaseDetails>
) {
  onChange({ ...value, ...partial });
}

function SectionTitle({ children }: { children: string }) {
  return <h4 className='patient-case-details-form__section-title'>{children}</h4>;
}

export default function PatientCaseDetailsForm({
  value,
  onChange,
  specialties,
  specialtyMode,
  doctorSpecialty,
  showPreferences = false,
  showConsent = false,
  showCaseSections = true,
  sectionsThrough = 8,
  disabled = false,
  readOnly = false
}: PatientCaseDetailsFormProps) {
  const isDisabled = disabled || readOnly;
  const showPreferencesSection = sectionsThrough >= 8 && showPreferences;
  const showConsentSection = sectionsThrough >= 8 && showConsent;

  const toggleQuestion = (question: SecondOpinionQuestion) => {
    const exists = value.questionCategories.includes(question);
    patch(value, onChange, {
      questionCategories: exists
        ? value.questionCategories.filter((item) => item !== question)
        : [...value.questionCategories, question]
    });
  };

  return (
    <div className='patient-case-details-form'>
      {showCaseSections ? (
        <>
      <SectionTitle>1. Consultation Details</SectionTitle>
      <div className='patient-case-details-form__grid'>
        <label className='opinion-message-label patient-case-details-form__full'>
          Primary Health Concern / Diagnosis
          <textarea
            className='opinion-message'
            rows={3}
            value={value.primaryHealthConcern}
            onChange={(event) => patch(value, onChange, { primaryHealthConcern: event.target.value })}
            disabled={isDisabled}
          />
        </label>

        <label className='opinion-message-label'>
          Specialty Required
          {specialtyMode === 'from_doctor' ? (
            <input
              className='opinion-select'
              value={doctorSpecialty ?? value.specialtyRequired}
              readOnly
              disabled
            />
          ) : (
            <select
              className='opinion-select'
              value={value.specialtyRequired}
              onChange={(event) => patch(value, onChange, { specialtyRequired: event.target.value })}
              disabled={isDisabled}
            >
              <option value=''>Select a specialty…</option>
              {specialties.map((specialty) => (
                <option key={specialty} value={specialty}>
                  {specialty}
                </option>
              ))}
            </select>
          )}
        </label>

        <label className='opinion-message-label'>
          Reason for Seeking a Second Opinion
          <select
            className='opinion-select'
            value={value.reasonForSecondOpinion}
            onChange={(event) =>
              patch(value, onChange, {
                reasonForSecondOpinion: event.target.value as PatientCaseDetails['reasonForSecondOpinion']
              })
            }
            disabled={isDisabled}
          >
            <option value=''>Select a reason…</option>
            {SECOND_OPINION_REASON_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        {value.reasonForSecondOpinion === 'Other' ? (
          <label className='opinion-message-label patient-case-details-form__full'>
            Describe your reason
            <textarea
              className='opinion-message'
              rows={2}
              value={value.reasonForSecondOpinionOther}
              onChange={(event) =>
                patch(value, onChange, { reasonForSecondOpinionOther: event.target.value })
              }
              disabled={isDisabled}
            />
          </label>
        ) : null}
      </div>

      <SectionTitle>2. Current Medical Condition</SectionTitle>
      <div className='patient-case-details-form__grid'>
        <label className='opinion-message-label patient-case-details-form__full'>
          Brief Description of Symptoms
          <textarea
            className='opinion-message'
            rows={3}
            value={value.symptomsDescription}
            onChange={(event) => patch(value, onChange, { symptomsDescription: event.target.value })}
            disabled={isDisabled}
          />
        </label>

        <PatientBirthDatePicker
          label='Date Symptoms Started'
          value={value.symptomsStartedDate}
          onChange={(date) => patch(value, onChange, { symptomsStartedDate: date })}
          disabled={isDisabled}
          placeholder='Select date'
        />

        <label className='opinion-message-label'>
          Severity of Symptoms
          <select
            className='opinion-select'
            value={value.symptomSeverity}
            onChange={(event) =>
              patch(value, onChange, {
                symptomSeverity: event.target.value as PatientCaseDetails['symptomSeverity']
              })
            }
            disabled={isDisabled}
          >
            <option value=''>Select severity…</option>
            {SYMPTOM_SEVERITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className='opinion-message-label patient-case-details-form__full'>
          Current Diagnosis (if any)
          <textarea
            className='opinion-message'
            rows={2}
            value={value.currentDiagnosis}
            onChange={(event) => patch(value, onChange, { currentDiagnosis: event.target.value })}
            disabled={isDisabled}
          />
        </label>

        <label className='opinion-message-label patient-case-details-form__full'>
          Current Treatment Plan
          <textarea
            className='opinion-message'
            rows={3}
            value={value.currentTreatmentPlan}
            onChange={(event) => patch(value, onChange, { currentTreatmentPlan: event.target.value })}
            disabled={isDisabled}
          />
        </label>
      </div>

      <SectionTitle>3. Medical History</SectionTitle>
      <div className='patient-case-details-form__grid'>
        {(
          [
            ['Existing Medical Conditions', 'existingMedicalConditions'],
            ['Previous Surgeries', 'previousSurgeries'],
            ['Relevant Family History', 'familyHistory'],
            ['Known Allergies', 'knownAllergies'],
            ['Current Medications', 'currentMedications']
          ] as const
        ).map(([label, key]) => (
          <label key={key} className='opinion-message-label patient-case-details-form__full'>
            {label}
            <textarea
              className='opinion-message'
              rows={2}
              value={value[key]}
              onChange={(event) => patch(value, onChange, { [key]: event.target.value })}
              disabled={isDisabled}
            />
          </label>
        ))}
      </div>

      <SectionTitle>4. Current Healthcare Provider</SectionTitle>
      <div className='patient-case-details-form__grid'>
        <label className='opinion-message-label'>
          Treating Doctor Name
          <input
            className='opinion-select'
            value={value.treatingDoctorName}
            onChange={(event) => patch(value, onChange, { treatingDoctorName: event.target.value })}
            disabled={isDisabled}
          />
        </label>

        <label className='opinion-message-label'>
          Hospital / Clinic Name
          <input
            className='opinion-select'
            value={value.hospitalClinicName}
            onChange={(event) => patch(value, onChange, { hospitalClinicName: event.target.value })}
            disabled={isDisabled}
          />
        </label>

        <label className='opinion-message-label'>
          Specialty of Treating Doctor
          <select
            className='opinion-select'
            value={value.treatingDoctorSpecialty}
            onChange={(event) =>
              patch(value, onChange, { treatingDoctorSpecialty: event.target.value })
            }
            disabled={isDisabled}
          >
            <option value=''>Select a specialty…</option>
            {specialties.map((specialty) => (
              <option key={specialty} value={specialty}>
                {specialty}
              </option>
            ))}
          </select>
        </label>

        <PatientBirthDatePicker
          label='Date of Last Consultation'
          value={value.lastConsultationDate}
          onChange={(date) => patch(value, onChange, { lastConsultationDate: date })}
          disabled={isDisabled}
          placeholder='Select date'
        />
      </div>

      <SectionTitle>6. Questions for the Second Opinion Doctor</SectionTitle>
      <fieldset className='opinion-fieldset patient-case-details-form__fieldset'>
        <legend>What specific questions would you like answered?</legend>
        <ul className='patient-case-details-form__checkbox-list'>
          {SECOND_OPINION_QUESTION_OPTIONS.map((question) => (
            <li key={question}>
              <label className='patient-case-details-form__checkbox-item'>
                <input
                  type='checkbox'
                  checked={value.questionCategories.includes(question)}
                  onChange={() => toggleQuestion(question)}
                  disabled={isDisabled}
                />
                <span>{question}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {value.questionCategories.includes('Other') ? (
        <label className='opinion-message-label patient-case-details-form__full'>
          Describe your other question
          <textarea
            className='opinion-message'
            rows={2}
            value={value.questionCategoriesOther}
            onChange={(event) =>
              patch(value, onChange, { questionCategoriesOther: event.target.value })
            }
            disabled={isDisabled}
          />
        </label>
      ) : null}

      <label className='opinion-message-label patient-case-details-form__full'>
        Additional Questions or Concerns
        <textarea
          className='opinion-message'
          rows={3}
          value={value.additionalQuestions}
          onChange={(event) => patch(value, onChange, { additionalQuestions: event.target.value })}
          disabled={isDisabled}
        />
      </label>

        </>
      ) : null}

      {showPreferencesSection ? (
        <>
          <SectionTitle> Consultation Preferences</SectionTitle>
          <div className='patient-case-details-form__grid'>
            <label className='opinion-message-label'>
              Preferred Consultation Mode
              <select
                className='opinion-select'
                value={value.preferredConsultationMode}
                onChange={(event) =>
                  patch(value, onChange, {
                    preferredConsultationMode:
                      event.target.value as PatientCaseDetails['preferredConsultationMode']
                  })
                }
                disabled={isDisabled}
              >
                <option value=''>Select a mode…</option>
                {CONSULTATION_MODE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <div className='patient-case-details-form__full'>
              <PreferredLanguageMultiSelect
                label='Preferred Language'
                value={value.preferredLanguages}
                onChange={(languages) => patch(value, onChange, { preferredLanguages: languages })}
                disabled={isDisabled}
              />
            </div>

            <div className='patient-case-details-form__full'>
              <PreferredTimeSlotsPicker
                value={value.preferredTimeSlots}
                onChange={(slots) => patch(value, onChange, { preferredTimeSlots: slots })}
                disabled={isDisabled}
              />
            </div>
          </div>
        </>
      ) : null}

      {showConsentSection ? (
        <>
          <SectionTitle>Consent</SectionTitle>
          <fieldset className='opinion-fieldset patient-case-details-form__fieldset'>
            <legend>Please confirm the following</legend>
            <ul className='patient-case-details-form__checkbox-list'>
              {(
                [
                  [
                    'consentInformationAccurate',
                    'I confirm that the information provided is accurate.'
                  ],
                  [
                    'consentShareRecords',
                    'I consent to sharing my medical records with the consulting doctor.'
                  ],
                  [
                    'consentNotEmergencyCare',
                    'I understand that a second opinion does not replace emergency medical care.'
                  ]
                ] as const
              ).map(([key, label]) => (
                <li key={key}>
                  <label className='patient-case-details-form__checkbox-item'>
                    <input
                      type='checkbox'
                      checked={value[key]}
                      onChange={(event) => patch(value, onChange, { [key]: event.target.checked })}
                      disabled={isDisabled}
                    />
                    <span>{label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </>
      ) : null}
    </div>
  );
}

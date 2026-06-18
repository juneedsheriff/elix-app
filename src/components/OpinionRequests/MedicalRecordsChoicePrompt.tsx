type MedicalRecordsChoicePromptProps = {
  onUpload: () => void;
  onProceedWithout: () => void;
  disabled?: boolean;
  question?: string;
};

export default function MedicalRecordsChoicePrompt({
  onUpload,
  onProceedWithout,
  disabled = false,
  question = 'Do you want to upload medical records or proceed without medical records?'
}: MedicalRecordsChoicePromptProps) {
  return (
    <div className='medical-records-choice' role='group' aria-labelledby='medical-records-choice-label'>
      <p id='medical-records-choice-label' className='medical-records-choice__question'>
        {question}
      </p>
      <div className='medical-records-choice__actions'>
        <button type='button' className='primary-btn' onClick={onUpload} disabled={disabled}>
          Upload medical records
        </button>
        <button type='button' className='secondary-btn' onClick={onProceedWithout} disabled={disabled}>
          Proceed without medical records
        </button>
      </div>
    </div>
  );
}

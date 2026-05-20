import SectionCard from '../../components/ui/SectionCard';

export default function TimelinePage() {
  return (
    <div className='screen-grid'>
      <SectionCard title='Medical timeline + AI insights' subtitle='Chronological, searchable, multilingual history'>
        <div className='timeline'>
          <div>
            <strong>Mar 11</strong>
            <p>Lab report uploaded, OCR complete, symptom extraction generated.</p>
          </div>
          <div>
            <strong>Mar 14</strong>
            <p>Second opinion from cardiology: recommend additional echocardiogram.</p>
          </div>
          <div>
            <strong>Mar 16</strong>
            <p>AI recommendation engine matched top endocrinology specialists in UK and India.</p>
          </div>
        </div>
      </SectionCard>
      <SectionCard title='AI assistant' subtitle='Ask contextual questions across your records'>
        <p className='muted'>
          "What changed between my two blood reports?" • "Translate this MRI note to Arabic" • "Prepare questions for
          your next consultation"
        </p>
        <button type='button' className='primary-btn'>
          Open AI health assistant
        </button>
      </SectionCard>
    </div>
  );
}

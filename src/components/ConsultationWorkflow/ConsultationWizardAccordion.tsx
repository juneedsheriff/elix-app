import { ChevronDown, Lock } from 'lucide-react';
import type { WizardStepDef, WizardStepState } from '../../lib/consultationWizard';
import './consultation-wizard.css';

type ConsultationWizardAccordionProps = {
  steps: Array<WizardStepDef & { state: WizardStepState }>;
  expandedIndex: number | null;
  suggestedIndex: number;
  canNavigate: (index: number) => boolean;
  onToggle: (index: number) => void;
  renderPanel: (index: number) => React.ReactNode;
  heading?: string;
  className?: string;
};

export default function ConsultationWizardAccordion({
  steps,
  expandedIndex,
  suggestedIndex,
  canNavigate,
  onToggle,
  renderPanel,
  heading,
  className = ''
}: ConsultationWizardAccordionProps) {
  const activeStep = steps[expandedIndex ?? suggestedIndex];

  return (
    <div className={`consultation-wizard-accordion-root ${className}`.trim()}>
      {heading ? <h4 className='patient-consultation-wizard__heading'>{heading}</h4> : null}
      {activeStep ? (
        <p className='consultation-wizard__mobile-summary' aria-live='polite'>
          <strong>
            Step {activeStep.id} of {steps.length}
          </strong>
          {activeStep.title}
        </p>
      ) : null}
      <nav className='consultation-wizard-accordion' aria-label='Coordination progress'>
        <ol className='consultation-wizard-accordion__track'>
          {steps.map((step, index) => {
            const stepDef = steps[index];
            const isLast = index === steps.length - 1;
            const isAccessible = canNavigate(index);
            const isExpanded = expandedIndex === index;
            const isCurrent = index === suggestedIndex;
            const stateClass =
              step.state === 'complete'
                ? 'consultation-wizard__step--complete'
                : isCurrent
                  ? 'consultation-wizard__step--current'
                  : 'consultation-wizard__step--upcoming';

            return (
              <li
                key={stepDef.id}
                className={`consultation-wizard-accordion__item consultation-wizard__step ${stateClass} ${
                  isExpanded ? 'consultation-wizard-accordion__item--expanded' : ''
                } ${!isAccessible ? 'consultation-wizard-accordion__item--locked' : ''}`}
              >
                <div className='consultation-wizard-accordion__header'>
                  {isAccessible ? (
                    <button
                      type='button'
                      className='consultation-wizard-accordion__trigger'
                      onClick={() => onToggle(index)}
                      aria-expanded={isExpanded}
                      aria-controls={`coordination-step-panel-${index}`}
                      id={`coordination-step-header-${index}`}
                    >
                      <span className='consultation-wizard__circle'>{stepDef.id}</span>
                      <span className='consultation-wizard__labels'>
                        <span className='consultation-wizard__title'>{stepDef.title}</span>
                        <span className='consultation-wizard__subtitle'>{stepDef.subtitle}</span>
                      </span>
                      <ChevronDown size={18} className='consultation-wizard-accordion__chevron' aria-hidden />
                    </button>
                  ) : (
                    <div
                      className='consultation-wizard-accordion__trigger consultation-wizard-accordion__trigger--locked'
                      aria-disabled='true'
                    >
                      <span className='consultation-wizard__circle'>{stepDef.id}</span>
                      <span className='consultation-wizard__labels'>
                        <span className='consultation-wizard__title'>{stepDef.title}</span>
                        <span className='consultation-wizard__subtitle'>{stepDef.subtitle}</span>
                      </span>
                      <Lock size={16} className='consultation-wizard-accordion__lock' aria-hidden />
                    </div>
                  )}
                </div>

                {isAccessible && isExpanded ? (
                  <div
                    id={`coordination-step-panel-${index}`}
                    role='region'
                    aria-labelledby={`coordination-step-header-${index}`}
                    className='consultation-wizard-accordion__panel'
                  >
                    {renderPanel(index)}
                  </div>
                ) : null}

                {!isLast ? (
                  <span
                    className={`consultation-wizard__connector ${
                      step.state === 'complete' ? 'consultation-wizard__connector--complete' : ''
                    }`}
                    aria-hidden
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

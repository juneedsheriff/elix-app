import type { WizardAudience, WizardStepDef, WizardStepState } from '../../lib/consultationWizard';
import './consultation-wizard.css';

type ConsultationWizardStepperProps = {
  audience: WizardAudience;
  steps: Array<WizardStepDef & { state: WizardStepState }>;
  activeIndex: number;
  onStepClick?: (index: number) => void;
  canNavigate?: (index: number) => boolean;
  /** Force vertical timeline layout (recommended on patient mobile detail). */
  layout?: 'auto' | 'vertical';
};

export default function ConsultationWizardStepper({
  steps,
  activeIndex,
  onStepClick,
  canNavigate,
  layout = 'auto'
}: ConsultationWizardStepperProps) {
  const activeStep = steps[activeIndex];
  const layoutClass =
    layout === 'vertical' ? 'consultation-wizard--vertical' : '';

  return (
    <div className={layoutClass}>
      {activeStep ? (
        <p className='consultation-wizard__mobile-summary' aria-live='polite'>
          <strong>
            Step {activeStep.id} of {steps.length}
          </strong>
          {activeStep.title}
        </p>
      ) : null}
      <nav className='consultation-wizard' aria-label='Consultation progress'>
      <ol className='consultation-wizard__track'>
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const clickable = Boolean(onStepClick && (!canNavigate || canNavigate(index)));
          const isActive = index === activeIndex;
          const stateClass =
            step.state === 'complete'
              ? 'consultation-wizard__step--complete'
              : isActive
                ? 'consultation-wizard__step--current'
                : 'consultation-wizard__step--upcoming';

          return (
            <li
              key={step.id}
              className={`consultation-wizard__step ${stateClass}`}
            >
              <div className='consultation-wizard__step-inner'>
                {clickable ? (
                  <button
                    type='button'
                    className='consultation-wizard__button'
                    onClick={() => onStepClick?.(index)}
                    aria-current={isActive ? 'step' : undefined}
                  >
                    <span className='consultation-wizard__circle'>{step.id}</span>
                    <span className='consultation-wizard__labels'>
                      <span className='consultation-wizard__title'>{step.title}</span>
                      <span className='consultation-wizard__subtitle'>{step.subtitle}</span>
                    </span>
                  </button>
                ) : (
                  <div className='consultation-wizard__button consultation-wizard__button--static'>
                    <span className='consultation-wizard__circle'>{step.id}</span>
                    <span className='consultation-wizard__labels'>
                      <span className='consultation-wizard__title'>{step.title}</span>
                      <span className='consultation-wizard__subtitle'>{step.subtitle}</span>
                    </span>
                  </div>
                )}
              </div>
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

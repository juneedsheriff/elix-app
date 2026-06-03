import {
  Calendar,
  Check,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileText,
  Lock,
  ShieldCheck,
  Users
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WizardStepDef, WizardStepState } from '../../lib/consultationWizard';
import './consultation-wizard.css';

const COORDINATION_STEP_ICONS: LucideIcon[] = [
  ClipboardList,
  FileText,
  Users,
  CreditCard,
  Calendar,
  FileText
];

type ConsultationWizardAccordionProps = {
  steps: Array<WizardStepDef & { state: WizardStepState }>;
  expandedIndex: number | null;
  suggestedIndex: number;
  canNavigate: (index: number) => boolean;
  onToggle: (index: number) => void;
  renderPanel: (index: number) => React.ReactNode;
  heading?: string;
  subheading?: string;
  className?: string;
  ariaLabel?: string;
  panelIdPrefix?: string;
};

export default function ConsultationWizardAccordion({
  steps,
  expandedIndex,
  suggestedIndex,
  canNavigate,
  onToggle,
  renderPanel,
  heading,
  subheading,
  className = '',
  ariaLabel = 'Coordination progress',
  panelIdPrefix = 'coordination-step'
}: ConsultationWizardAccordionProps) {
  const activeStep = steps[expandedIndex ?? suggestedIndex];

  return (
    <div
      className={`consultation-wizard-accordion-root patient-consultation-wizard--modern ${className}`.trim()}
    >
      {heading ? (
        <header className='patient-consultation-wizard__hero'>
          <div className='patient-consultation-wizard__hero-text'>
            <h4 className='patient-consultation-wizard__heading'>{heading}</h4>
            {subheading ? (
              <p className='patient-consultation-wizard__subheading'>{subheading}</p>
            ) : null}
          </div>
          <div className='patient-consultation-wizard__hero-art' aria-hidden>
            <span className='patient-consultation-wizard__hero-clipboard'>
              <ClipboardList size={34} strokeWidth={1.5} />
            </span>
            <span className='patient-consultation-wizard__hero-shield'>
              <ShieldCheck size={18} strokeWidth={2} />
            </span>
          </div>
        </header>
      ) : null}

      {activeStep ? (
        <p className='consultation-wizard__mobile-summary' aria-live='polite'>
          <strong>
            Step {activeStep.id} of {steps.length}
          </strong>
          {activeStep.title}
        </p>
      ) : null}

      <nav className='patient-wizard-timeline' aria-label={ariaLabel}>
        <ol className='patient-wizard-timeline__track'>
          {steps.map((stepDef, index) => {
            const step = steps[index];
            const isLast = index === steps.length - 1;
            const isAccessible = canNavigate(index);
            const isExpanded = expandedIndex === index;
            const isCurrent = index === suggestedIndex;
            const isComplete = step.state === 'complete';
            const StepIcon = COORDINATION_STEP_ICONS[index] ?? FileText;
            const stateClass = isComplete
              ? 'patient-wizard-timeline__step--complete'
              : isCurrent
                ? 'patient-wizard-timeline__step--current'
                : 'patient-wizard-timeline__step--upcoming';

            return (
              <li
                key={stepDef.id}
                className={`patient-wizard-timeline__step ${stateClass} ${
                  isExpanded ? 'patient-wizard-timeline__step--expanded' : ''
                } ${!isAccessible ? 'patient-wizard-timeline__step--locked' : ''}`}
              >
                <div className='patient-wizard-timeline__rail' aria-hidden>
                  <span className='patient-wizard-timeline__marker'>{stepDef.id}</span>
                  {!isLast ? <span className='patient-wizard-timeline__line' /> : null}
                </div>

                <article className='patient-wizard-card'>
                  {isAccessible ? (
                    <button
                      type='button'
                      className='patient-wizard-card__header'
                      onClick={() => onToggle(index)}
                      aria-expanded={isExpanded}
                      aria-controls={`${panelIdPrefix}-panel-${index}`}
                      id={`${panelIdPrefix}-header-${index}`}
                    >
                      <span className='patient-wizard-card__icon' aria-hidden>
                        {isComplete && index === 0 ? (
                          <Check size={20} strokeWidth={2.5} />
                        ) : (
                          <StepIcon size={20} strokeWidth={2} />
                        )}
                      </span>
                      <span className='patient-wizard-card__labels'>
                        <span className='patient-wizard-card__title-row'>
                          <span className='patient-wizard-card__title'>{stepDef.title}</span>
                          {isCurrent ? (
                            <span className='patient-wizard-card__badge'>In progress</span>
                          ) : null}
                        </span>
                        <span className='patient-wizard-card__subtitle'>{stepDef.subtitle}</span>
                      </span>
                      <ChevronDown size={18} className='patient-wizard-card__chevron' aria-hidden />
                    </button>
                  ) : (
                    <div
                      className='patient-wizard-card__header patient-wizard-card__header--locked'
                      aria-disabled='true'
                    >
                      <span className='patient-wizard-card__icon' aria-hidden>
                        <StepIcon size={20} strokeWidth={2} />
                      </span>
                      <span className='patient-wizard-card__labels'>
                        <span className='patient-wizard-card__title'>{stepDef.title}</span>
                        <span className='patient-wizard-card__subtitle'>{stepDef.subtitle}</span>
                      </span>
                      <Lock size={16} className='patient-wizard-card__lock' aria-hidden />
                    </div>
                  )}

                  {isAccessible && isExpanded ? (
                    <div
                      id={`${panelIdPrefix}-panel-${index}`}
                      role='region'
                      aria-labelledby={`${panelIdPrefix}-header-${index}`}
                      className='patient-wizard-card__panel'
                    >
                      <div className='patient-wizard-card__panel-inner'>{renderPanel(index)}</div>
                    </div>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

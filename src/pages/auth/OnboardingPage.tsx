import { ONBOARDING_ICONS } from '../../navIcons';

type OnboardingItem = { title: string; body: string };

type OnboardingPageProps = {
  welcome: string;
  tagline: string;
  items: OnboardingItem[];
  skipLabel: string;
  continueLabel: string;
  onSkip: () => void;
  onContinue: () => void;
};

export default function OnboardingPage({
  welcome,
 
  items,
  skipLabel,
  continueLabel,
  onSkip,
  onContinue
}: OnboardingPageProps) {
  return (
    <div className='mobile-shell mobile-shell--stage onboarding-shell'>
      <div className='onboarding-page'>
        <div className='onboarding-main'>
          <header className='onboarding-hero'>
             <img src="/logo-small-2.png" alt="elix" />
            <h3 className='onboarding-title'>{welcome}</h3>
           </header>

          <ul className='onboarding-steps' aria-label='App highlights'>
            {items.map((item, index) => {
              const Icon = ONBOARDING_ICONS[index];
              return (
                <li key={item.title} className='onboarding-step'>
                  <div className='onboarding-step-body'>
                    
                    <span className='onboard-icon onboarding-step-icon' aria-hidden>
                      <Icon size={20} strokeWidth={2} />
                    </span>
                    <div className='onboarding-step-text'>
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <footer className='onboarding-footer'>
          <div className='onboarding-footer-actions'>
            <button type='button' className='secondary-btn onboarding-btn' onClick={onSkip}>
              {skipLabel}
            </button>
            <button type='button' className='primary-btn onboarding-btn' onClick={onContinue}>
              {continueLabel}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

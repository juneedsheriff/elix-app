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
  tagline,
  items,
  skipLabel,
  continueLabel,
  onSkip,
  onContinue
}: OnboardingPageProps) {
  return (
    <div className='mobile-shell mobile-shell--stage'>
      <section className='auth-stage onboarding'>
        <h1>{welcome}</h1>
        <p>{tagline}</p>
        <div className='onboard-grid'>
          {items.map((item, index) => {
            const Icon = ONBOARDING_ICONS[index];
            return (
              <article key={item.title}>
                <span className='onboard-icon' aria-hidden>
                  <Icon size={22} strokeWidth={2} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            );
          })}
        </div>
        <div className='row onboard-actions'>
          <button type='button' className='secondary-btn' onClick={onSkip}>
            {skipLabel}
          </button>
          <button type='button' className='primary-btn' onClick={onContinue}>
            {continueLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

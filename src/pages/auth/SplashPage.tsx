import ElixLogo from '../../components/ui/ElixLogo';

type SplashPageProps = {
  welcome: string;
  tagline: string;
};

export default function SplashPage({ welcome, tagline }: SplashPageProps) {
  return (
    <div className='mobile-shell mobile-shell--stage'>
      <section className='splash'>
        <div className='logo-badge'>
          <ElixLogo className='brand-logo' width={200} height={80} />
        </div>
        <h2>{welcome}</h2>
        <p>{tagline}</p>
      </section>
    </div>
  );
}

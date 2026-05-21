type SplashPageProps = {
  welcome: string;
  tagline: string;
};

export default function SplashPage({ welcome, tagline }: SplashPageProps) {
  return (
    <div className='mobile-shell mobile-shell--stage'>
      <section className='splash'>
        <div className='logo-badge'>
          <img className='brand-logo' src='/icons/elix-logo-transparent.png' alt='Elix' width={200} height={80} />
        </div>
        <h2>{welcome}</h2>
        <p>{tagline}</p>
      </section>
    </div>
  );
}

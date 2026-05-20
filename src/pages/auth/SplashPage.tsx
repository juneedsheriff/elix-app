type SplashPageProps = {
  welcome: string;
  tagline: string;
};

export default function SplashPage({ welcome, tagline }: SplashPageProps) {
  return (
    <div className='mobile-shell mobile-shell--stage'>
      <section className='splash'>
        <div className='logo-badge'>
          <img src='/logo-small-2.png' alt='elix' />
        </div>
        <h2>{welcome}</h2>
        <p>{tagline}</p>
      </section>
    </div>
  );
}

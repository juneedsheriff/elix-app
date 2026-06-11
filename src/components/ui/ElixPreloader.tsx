type ElixPreloaderProps = {
  label?: string;
};

export default function ElixPreloader({ label = 'Loading' }: ElixPreloaderProps) {
  return (
    <div className='elix-preloader' role='status' aria-live='polite' aria-busy='true'>
      <div className='elix-preloader__content'>
        <img
          className='elix-preloader__logo'
          src='/icons/elix-logo-transparent.png'
          alt='Elix'
          width={200}
          height={80}
        />
        <span className='elix-preloader__label'>{label}</span>
      </div>
    </div>
  );
}

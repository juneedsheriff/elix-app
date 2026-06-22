import { ELIX_LOGO_ALT, ELIX_LOGO_SRC } from '../../lib/brandAssets';

type ElixLogoProps = {
  className?: string;
  width?: number;
  height?: number;
};

export default function ElixLogo({ className, width, height }: ElixLogoProps) {
  return (
    <img
      className={className}
      src={ELIX_LOGO_SRC}
      alt={ELIX_LOGO_ALT}
      width={width}
      height={height}
      decoding='async'
    />
  );
}

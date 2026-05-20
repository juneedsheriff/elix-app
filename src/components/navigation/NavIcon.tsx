import { SCREEN_ICONS } from '../../navIcons';

type NavIconProps = {
  screenId: string;
  size?: number;
};

export default function NavIcon({ screenId, size = 18 }: NavIconProps) {
  const Icon = SCREEN_ICONS[screenId] ?? SCREEN_ICONS.settings;
  return <Icon size={size} strokeWidth={2} aria-hidden />;
}

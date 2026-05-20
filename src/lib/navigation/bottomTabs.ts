import type { LucideIcon } from 'lucide-react';
import { TRANSLATIONS, type Language, type Role } from '../../i18n/appTranslations';
import { BOTTOM_TAB_ICONS, SCREEN_ICONS } from '../../navIcons';

export type BottomTab = { id: string; label: string; icon: LucideIcon };

export function getBottomTabs(role: Role, language: Language): BottomTab[] {
  const t = TRANSLATIONS[language];
  if (role === 'doctor') {
    return [
      { id: 'doctor-dashboard', label: t.bottom.home, icon: SCREEN_ICONS['doctor-dashboard'] },
      { id: 'case-review', label: t.bottom.cases, icon: SCREEN_ICONS['case-review'] },
      { id: 'availability', label: t.bottom.schedule, icon: SCREEN_ICONS.availability },
      { id: 'settings', label: t.profile, icon: SCREEN_ICONS.settings }
    ];
  }
  if (role === 'admin') {
    return [
      { id: 'admin-dashboard', label: t.bottom.home, icon: SCREEN_ICONS['admin-dashboard'] },
      { id: 'user-management', label: t.bottom.users, icon: SCREEN_ICONS['user-management'] },
      { id: 'admin-analytics', label: t.bottom.stats, icon: SCREEN_ICONS['admin-analytics'] },
      { id: 'settings', label: t.profile, icon: SCREEN_ICONS.settings }
    ];
  }
  return [
    { id: 'doctor-dashboard', label: t.bottom.home, icon: SCREEN_ICONS['doctor-dashboard'] },
    { id: 'my-requests', label: t.bottom.requests, icon: SCREEN_ICONS['my-requests'] },
    { id: 'doctor-list', label: t.nav.patient['doctor-list'], icon: SCREEN_ICONS['doctor-list'] },
    { id: 'settings', label: t.profile, icon: BOTTOM_TAB_ICONS.profile }
  ];
}

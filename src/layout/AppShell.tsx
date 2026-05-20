import { Globe, Menu, Moon, Sun, X } from '../navIcons';
import NavIcon from '../components/navigation/NavIcon';
import LanguagePickerModal from '../components/Language/LanguagePickerModal';
import ScreenRouter from '../pages/ScreenRouter';
import { isDashboardScreen } from '../lib/dashboardTitle';
import { getNavItems, roleLabel, type Language, type Role } from '../i18n/appTranslations';
import type { BottomTab } from '../lib/navigation/bottomTabs';
import type { Doctor } from '../types/doctor';
import type { Patient } from '../types/patient';

type AppShellProps = {
  role: Role;
  language: Language;
  activeScreen: string;
  menuOpen: boolean;
  languageModalOpen: boolean;
  theme: 'light' | 'dark';
  bottomTabs: BottomTab[];
  userId?: string | null;
  userEmail?: string | null;
  doctorProfile: Doctor | null;
  patientProfile: Patient | null;
  dbConnected: boolean;
  copy: {
    dashboard: string;
    welcome: string;
    languageLabel: string;
    chooseLanguage: string;
    close: string;
  };
  onMenuToggle: () => void;
  onMenuClose: () => void;
  onNavigate: (screenId: string) => void;
  onLanguageModalOpen: () => void;
  onLanguageModalClose: () => void;
  onLanguageChange: (language: Language) => void;
  onThemeToggle: () => void;
  onSignOut?: () => void;
};

export default function AppShell({
  role,
  language,
  activeScreen,
  menuOpen,
  languageModalOpen,
  theme,
  bottomTabs,
  userId,
  userEmail,
  doctorProfile,
  patientProfile,
  dbConnected,
  copy,
  onMenuToggle,
  onMenuClose,
  onNavigate,
  onLanguageModalOpen,
  onLanguageModalClose,
  onLanguageChange,
  onThemeToggle,
  onSignOut
}: AppShellProps) {
  const navItems = getNavItems(role, language);
  const activeNavItem = navItems.find((item) => item.id === activeScreen);

  return (
    <div className='mobile-shell'>
      <div className='status-bar' aria-hidden>
        <span>9:41</span>
        <span className='status-bar-notch' />
        <span className='status-dots'>●●●</span>
      </div>

      <section className={`workspace ${menuOpen ? 'menu-open' : ''}`}>
        <header className='topbar mobile-header'>
          <button
            type='button'
            className='icon-btn menu-toggle'
            onClick={onMenuToggle}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className='mobile-header-titles'>
            <h1>{isDashboardScreen(activeScreen) ? copy.dashboard : (activeNavItem?.label ?? copy.welcome)}</h1>
            <p>
              {roleLabel(language, role)} • Elix
            </p>
          </div>
          <div className='topbar-controls'>
            <button
              type='button'
              className='icon-btn lang-btn'
              onClick={onLanguageModalOpen}
              aria-label={`${copy.languageLabel}: ${language.toUpperCase()}`}
              aria-haspopup='dialog'
              aria-expanded={languageModalOpen}
            >
              <Globe size={18} aria-hidden />
              <span className='lang-code'>{language.toUpperCase()}</span>
            </button>
            <LanguagePickerModal
              open={languageModalOpen}
              current={language}
              title={copy.chooseLanguage}
              closeLabel={copy.close}
              onClose={onLanguageModalClose}
              onSelect={onLanguageChange}
            />
            <button
              type='button'
              className='icon-btn'
              onClick={onThemeToggle}
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
          </div>
        </header>

        {menuOpen ? (
          <button type='button' className='sidebar-backdrop' onClick={onMenuClose} aria-label='Close menu' />
        ) : null}

        <nav className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`} aria-label='Main navigation' aria-hidden={!menuOpen}>
          {navItems.map((item) => (
            <button
              key={item.id}
              type='button'
              className={`nav-btn ${item.id === activeScreen ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <NavIcon screenId={item.id} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className='layout'>
          <section className='content-area'>
            <ScreenRouter
              screenId={activeScreen}
              userId={userId}
              userEmail={userEmail}
              doctorProfile={doctorProfile}
              patientProfile={patientProfile}
              dbConnected={dbConnected}
              onSignOut={onSignOut}
              onNavigate={onNavigate}
            />
          </section>
        </div>

        <nav className='bottom-nav' aria-label='Quick navigation'>
          {bottomTabs.map((tab) => (
            <button
              key={tab.id}
              type='button'
              className={`bottom-nav-item ${tab.id === activeScreen ? 'active' : ''}`}
              onClick={() => onNavigate(tab.id)}
            >
              <tab.icon size={22} strokeWidth={2} aria-hidden />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </section>
    </div>
  );
}

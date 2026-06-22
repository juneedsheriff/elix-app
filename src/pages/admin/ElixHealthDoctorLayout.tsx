import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronRight, ClipboardList, LayoutDashboard, LogOut, Menu, Stethoscope, X } from 'lucide-react';
import ElixLogo from '../../components/ui/ElixLogo';
import type { Doctor } from '../../types/doctor';
import {
  doctorNavIdFromPathname,
  doctorPageTitleFromPathname,
  ELIX_HEALTH_PATHS,
  type ElixHealthDoctorNavId
} from './elixHealthRoutes';

type NavItem = {
  id: ElixHealthDoctorNavId;
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: ELIX_HEALTH_PATHS.workspace, icon: LayoutDashboard },
  { id: 'cases', label: 'Cases', path: ELIX_HEALTH_PATHS.workspaceCases, icon: ClipboardList },
  {
    id: 'availability',
    label: 'Scheduler',
    path: ELIX_HEALTH_PATHS.workspaceAvailability,
    icon: Calendar
  }
];

type ElixHealthDoctorLayoutProps = {
  doctor: Doctor;
  pathname: string;
  onSignOut: () => void;
  children: ReactNode;
};

export default function ElixHealthDoctorLayout({
  doctor,
  pathname,
  onSignOut,
  children
}: ElixHealthDoctorLayoutProps) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeNav = doctorNavIdFromPathname(pathname);
  const pageTitle = doctorPageTitleFromPathname(pathname);

  const closeSidebar = () => setSidebarOpen(false);

  const handleNav = (path: string) => {
    navigate(path);
    closeSidebar();
  };

  return (
    <div className='elixhealth-app'>
      {sidebarOpen ? (
        <button
          type='button'
          className='elixhealth-sidebar-backdrop'
          aria-label='Close menu'
          onClick={closeSidebar}
        />
      ) : null}

      <aside
        className={sidebarOpen ? 'elixhealth-sidebar elixhealth-sidebar--open' : 'elixhealth-sidebar'}
        aria-label='Doctor navigation'
      >
        <div className='elixhealth-sidebar-brand'>
          <div className='elixhealth-sidebar-logo-wrap'>
            <ElixLogo className='elixhealth-sidebar-logo' />
          </div>
          <div className='elixhealth-sidebar-brand-text'>
            <p className='elixhealth-sidebar-title'>ElixClinix</p>
            <span className='elixhealth-sidebar-role-badge'>Doctor</span>
          </div>
        </div>

        <nav className='elixhealth-sidebar-nav'>
          <p className='elixhealth-sidebar-section'>Workspace</p>
          <ul>
            {NAV_ITEMS.map(({ id, label, path, icon: Icon }) => {
              const isActive = activeNav === id;
              return (
                <li key={id}>
                  <button
                    type='button'
                    className={
                      isActive
                        ? 'elixhealth-sidebar-link elixhealth-sidebar-link--active'
                        : 'elixhealth-sidebar-link'
                    }
                    onClick={() => handleNav(path)}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className='elixhealth-sidebar-link-icon' aria-hidden>
                      <Icon size={18} />
                    </span>
                    <span className='elixhealth-sidebar-link-label'>{label}</span>
                    {isActive ? (
                      <ChevronRight size={16} className='elixhealth-sidebar-chevron' aria-hidden />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className='elixhealth-sidebar-footer'>
          <div className='elixhealth-sidebar-user-card' title={doctor.email}>
            <span className='elixhealth-sidebar-avatar' aria-hidden>
              <Stethoscope size={18} />
            </span>
            <div className='elixhealth-sidebar-user-text'>
              <strong>{doctor.full_name}</strong>
              <span>{doctor.specialty}</span>
            </div>
          </div>
          <button type='button' className='elixhealth-sidebar-signout' onClick={onSignOut}>
            <LogOut size={16} aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      <div className='elixhealth-main'>
        <header className='elixhealth-topbar'>
          <div className='elixhealth-topbar-start'>
            <button
              type='button'
              className='elixhealth-menu-toggle'
              aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen((open) => !open)}
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div>
              <p className='elixhealth-breadcrumb'>
                <span>Home</span>
                <ChevronRight size={14} aria-hidden />
                <span>{pageTitle}</span>
              </p>
            </div>
          </div>
          <div className='elixhealth-topbar-end'>
            <span className='elixhealth-topbar-user'>{doctor.full_name}</span>
          </div>
        </header>

        <main className='elixhealth-content'>{children}</main>
      </div>
    </div>
  );
}

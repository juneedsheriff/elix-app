import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, LayoutDashboard, LogOut, Menu, UserCog, X } from 'lucide-react';
import ElixLogo from '../../components/ui/ElixLogo';
import {
  avatarColorFromName,
  displayInitials,
  resolveProfilePhotoUrl
} from '../../lib/avatarDisplay';
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
  {
    id: 'dashboard',
    label: 'Patient Requests',
    path: ELIX_HEALTH_PATHS.workspace,
    icon: LayoutDashboard
  },
  {
    id: 'profile',
    label: 'Profile',
    path: ELIX_HEALTH_PATHS.workspaceProfile,
    icon: UserCog
  }
];

type ElixHealthDoctorLayoutProps = {
  doctor: Doctor;
  pathname: string;
  onSignOut: () => void;
  children: ReactNode;
};

function DoctorAvatar({ doctor, className }: { doctor: Doctor; className: string }) {
  const photoUrl = resolveProfilePhotoUrl(doctor.image_url);
  const initials = displayInitials(doctor.full_name);
  const bg = avatarColorFromName(doctor.full_name);

  if (photoUrl) {
    return (
      <span className={`${className} elixhealth-sidebar-avatar--photo`} aria-hidden>
        <img src={photoUrl} alt='' className='elixhealth-sidebar-avatar-img' />
      </span>
    );
  }

  return (
    <span
      className={`${className} elixhealth-sidebar-avatar--initials`}
      style={{ background: bg }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

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
          <button
            type='button'
            className='elixhealth-sidebar-user-card elixhealth-sidebar-user-card--button'
            title={doctor.email}
            onClick={() => handleNav(ELIX_HEALTH_PATHS.workspaceProfile)}
          >
            <DoctorAvatar doctor={doctor} className='elixhealth-sidebar-avatar' />
            <div className='elixhealth-sidebar-user-text'>
              <strong>{doctor.full_name}</strong>
              <span>{doctor.specialty}</span>
            </div>
          </button>
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
            <button
              type='button'
              className='elixhealth-topbar-user elixhealth-topbar-user--with-photo'
              onClick={() => handleNav(ELIX_HEALTH_PATHS.workspaceProfile)}
              title='Open profile'
            >
              <DoctorAvatar doctor={doctor} className='elixhealth-topbar-avatar' />
              <span>{doctor.full_name}</span>
            </button>
          </div>
        </header>

        <main className='elixhealth-content'>{children}</main>
      </div>
    </div>
  );
}

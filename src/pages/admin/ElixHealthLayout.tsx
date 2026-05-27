import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  Stethoscope,
  UserCircle,
  Users,
  X
} from 'lucide-react';
import type { Admin } from '../../types/admin';
import { adminRoleLabel, navItemsForRole, requestsNavLabel, type ElixHealthNavId } from '../../lib/staffPermissions';
import { ELIX_HEALTH_PATHS } from './elixHealthRoutes';

export type { ElixHealthNavId };

type NavItem = {
  id: ElixHealthNavId;
  label: string;
  path: string;
  icon: typeof Users;
};

const NAV_META: Record<ElixHealthNavId, { path: string; icon: typeof Users; label?: string }> = {
  overview: { path: ELIX_HEALTH_PATHS.overview, icon: LayoutDashboard },
  doctors: { path: ELIX_HEALTH_PATHS.doctors, icon: Stethoscope },
  patients: { path: ELIX_HEALTH_PATHS.patients, icon: UserCircle },
  requests: { path: ELIX_HEALTH_PATHS.requests, icon: ClipboardList },
  staff: { path: ELIX_HEALTH_PATHS.staff, icon: Shield }
};

const NAV_LABELS: Record<ElixHealthNavId, string> = {
  overview: 'Dashboard',
  doctors: 'Doctors',
  patients: 'Patients',
  requests: 'Requests',
  staff: 'Staff'
};

function navItemsForAdmin(admin: Admin): NavItem[] {
  return navItemsForRole(admin.role).map((id) => ({
    id,
    path: NAV_META[id].path,
    icon: NAV_META[id].icon,
    label: id === 'requests' ? requestsNavLabel(admin.role) : NAV_LABELS[id]
  }));
}

type ElixHealthLayoutProps = {
  admin: Admin;
  activeNav: ElixHealthNavId;
  pageTitle: string;
  onSignOut: () => void;
  children: ReactNode;
};

export default function ElixHealthLayout({
  admin,
  activeNav,
  pageTitle,
  onSignOut,
  children
}: ElixHealthLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navItems = navItemsForAdmin(admin);

  const closeSidebar = () => setSidebarOpen(false);

  const handleNav = (path: string) => {
    navigate(path);
    closeSidebar();
  };

  const isDoctorEdit = location.pathname === '/elixhealth/doctor';
  const isPatientEdit = location.pathname === '/elixhealth/patient';
  const breadcrumbSection =
    activeNav === 'doctors' && isDoctorEdit
      ? 'Doctors'
      : activeNav === 'patients' && isPatientEdit
        ? 'Patients'
        : pageTitle;

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
        aria-label='Admin navigation'
      >
        <div className='elixhealth-sidebar-brand'>
          <img src='/icons/elix-logo-transparent.png' alt='' className='elixhealth-sidebar-logo' />
          <div>
            <p className='elixhealth-sidebar-title'>Elix Health</p>
            <p className='elixhealth-sidebar-subtitle'>{adminRoleLabel(admin.role)}</p>
          </div>
        </div>

        <nav className='elixhealth-sidebar-nav'>
          <p className='elixhealth-sidebar-section'>Menu</p>
          <ul>
            {navItems.map(({ id, label, path, icon: Icon }) => (
              <li key={id}>
                <button
                  type='button'
                  className={
                    activeNav === id
                      ? 'elixhealth-sidebar-link elixhealth-sidebar-link--active'
                      : 'elixhealth-sidebar-link'
                  }
                  onClick={() => handleNav(path)}
                  aria-current={activeNav === id ? 'page' : undefined}
                >
                  <Icon size={18} aria-hidden />
                  <span>{label}</span>
                  {activeNav === id ? (
                    <ChevronRight size={16} className='elixhealth-sidebar-chevron' aria-hidden />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className='elixhealth-sidebar-footer'>
          <div className='elixhealth-sidebar-user' title={admin.email}>
            <span className='elixhealth-sidebar-avatar' aria-hidden>
              {admin.full_name.charAt(0).toUpperCase()}
            </span>
            <div className='elixhealth-sidebar-user-text'>
              <strong>{admin.full_name}</strong>
              <span>{admin.email}</span>
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
                <span>{breadcrumbSection}</span>
                {pageTitle !== breadcrumbSection ? (
                  <>
                    <ChevronRight size={14} aria-hidden />
                    <span>{pageTitle}</span>
                  </>
                ) : null}
              </p>
              
            </div>
          </div>
          <div className='elixhealth-topbar-end'>
            <span className='elixhealth-topbar-user'>{admin.full_name}</span>
          </div>
        </header>

        <main className='elixhealth-content'>{children}</main>
      </div>
    </div>
  );
}

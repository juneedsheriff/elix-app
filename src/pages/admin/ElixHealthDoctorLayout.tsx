import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, LayoutDashboard, LogOut, Menu, UserCog, X } from 'lucide-react';
import ElixLogo from '../../components/ui/ElixLogo';
import {
  avatarColorFromName,
  displayInitials,
  resolveProfilePhotoUrl
} from '../../lib/avatarDisplay';
import { fetchDoctorWorkspaceGrantsForDoctor } from '../../lib/clinicDoctorRequests';
import { fetchClinicLinkedDoctors, fetchDoctors, fetchDoctorsInClinicRoster } from '../../lib/doctors';
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

function displayDoctorName(doctor: Pick<Doctor, 'full_name' | 'email'>) {
  const fullName = doctor.full_name?.trim();
  if (fullName) return fullName;
  const email = doctor.email?.trim() || '';
  if (email.includes('@')) {
    return email.split('@')[0] || 'Doctor';
  }
  return email || 'Doctor';
}

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
  const [clinicDoctors, setClinicDoctors] = useState<Doctor[]>([]);
  const [clinicDoctorsLoading, setClinicDoctorsLoading] = useState(false);
  const activeNav = doctorNavIdFromPathname(pathname);
  const pageTitle = doctorPageTitleFromPathname(pathname);

  const closeSidebar = () => setSidebarOpen(false);

  const handleNav = (path: string) => {
    navigate(path);
    closeSidebar();
  };

  useEffect(() => {
    let cancelled = false;

    const loadClinicDoctors = async () => {
      setClinicDoctorsLoading(true);
      try {
        let clinicId = doctor.clinic_id?.trim() || '';

        if (!clinicId) {
          const grantsRes = await fetchDoctorWorkspaceGrantsForDoctor(doctor.id);
          clinicId = grantsRes.data?.[0]?.clinicId?.trim() || '';
        }

        // Primary source: browse-visible doctors, then scoped to the same clinic.
        const browseRes = await fetchDoctors(300, { patientClinicId: clinicId || null });
        let doctors = (browseRes.data ?? []).filter((candidate) => {
          const sameClinicId = Boolean(clinicId) && candidate.clinic_id === clinicId;
          const sameClinicName =
            Boolean(doctor.clinic_name?.trim()) &&
            candidate.clinic_name?.trim().toLowerCase() === doctor.clinic_name?.trim().toLowerCase();
          const samePseClinicName =
            Boolean(doctor.pse_clinic_name?.trim()) &&
            candidate.pse_clinic_name?.trim().toLowerCase() === doctor.pse_clinic_name?.trim().toLowerCase();
          return sameClinicId || sameClinicName || samePseClinicName;
        });

        // Fallback 1: direct clinic-roster queries.
        if (!doctors.length) {
          const rosterRes = await fetchDoctorsInClinicRoster({
            clinicId,
            clinicName: doctor.clinic_name,
            pseClinicName: doctor.pse_clinic_name
          });
          doctors = rosterRes.data ?? [];
        }

        // Fallback 2: linked-clinic lookup.
        if (!doctors.length && clinicId) {
          const linkedRes = await fetchClinicLinkedDoctors(clinicId);
          doctors = linkedRes.data ?? [];
        }

        // Exclude the currently logged-in doctor from the sidebar list.
        doctors = doctors.filter((candidate) => candidate.id !== doctor.id);

        if (!cancelled) {
          setClinicDoctors(doctors);
        }
      } finally {
        if (!cancelled) {
          setClinicDoctorsLoading(false);
        }
      }
    };

    void loadClinicDoctors();

    return () => {
      cancelled = true;
    };
  }, [doctor.clinic_id, doctor.id]);

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
            <li className='elixhealth-sidebar-doctors-menu'>
              <div className='elixhealth-sidebar-link elixhealth-sidebar-link--doctors-menu' aria-label='Doctors menu'>
                <span className='elixhealth-sidebar-link-icon' aria-hidden>
                  <LayoutDashboard size={18} />
                </span>
                  <span className='elixhealth-sidebar-link-label'>
                  Doctors
                  <span className='elixhealth-sidebar-doctors-count'>
                    {clinicDoctorsLoading ? ' (Loading...)' : ` (${clinicDoctors.length})`}
                  </span>
                </span>
              </div>

              {clinicDoctorsLoading ? (
                <p className='elixhealth-sidebar-doctors-empty'>Loading doctors...</p>
              ) : clinicDoctors.length ? (
                <ul className='elixhealth-sidebar-doctors-list'>
                  {clinicDoctors.map((linkedDoctor) => {
                    const doctorName = displayDoctorName(linkedDoctor);
                    const photoUrl = resolveProfilePhotoUrl(linkedDoctor.image_url);
                    const initials = displayInitials(doctorName);
                    const bg = avatarColorFromName(doctorName);

                    return (
                      <li key={linkedDoctor.id} className='elixhealth-sidebar-doctors-item'>
                        {photoUrl ? (
                          <span className='elixhealth-sidebar-doctors-avatar elixhealth-sidebar-doctors-avatar--photo'>
                            <img src={photoUrl} alt='' className='elixhealth-sidebar-doctors-avatar-img' />
                          </span>
                        ) : (
                          <span
                            className='elixhealth-sidebar-doctors-avatar elixhealth-sidebar-doctors-avatar--initials'
                            style={{ background: bg }}
                            aria-hidden
                          >
                            {initials}
                          </span>
                        )}
                        <span className='elixhealth-sidebar-doctors-name'>{doctorName}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className='elixhealth-sidebar-doctors-empty'>No linked doctors.</p>
              )}
            </li>
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
              <strong>{displayDoctorName(doctor)}</strong>
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
              <span>{displayDoctorName(doctor)}</span>
            </button>
          </div>
        </header>

        <main className='elixhealth-content'>{children}</main>
      </div>
    </div>
  );
}

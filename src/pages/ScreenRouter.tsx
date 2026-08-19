import { Suspense, lazy, type ReactNode } from 'react';
import ElixPreloader from '../components/ui/ElixPreloader';
import type { ScreenPageProps } from './types';
const AdminDashboardPage = lazy(() => import('./admin/AdminDashboardPage'));
const CmsAuditPage = lazy(() => import('./admin/CmsAuditPage'));
const UserManagementPage = lazy(() => import('./admin/UserManagementPage'));
const DoctorConsultationPage = lazy(() => import('./doctor/DoctorConsultationPage'));
const DoctorDashboardPage = lazy(() => import('./doctor/DoctorDashboardPage'));
const DoctorsPage = lazy(() => import('./patient/DoctorsPage'));
const MyRequestsPage = lazy(() => import('./patient/MyRequestsPage'));
const NotificationsPage = lazy(() => import('./patient/NotificationsPage'));
const PatientDashboardPage = lazy(() => import('./patient/PatientDashboardPage'));
const PaymentsPage = lazy(() => import('./patient/PaymentsPage'));
const TimelinePage = lazy(() => import('./patient/TimelinePage'));
const UploadRecordsPage = lazy(() => import('./patient/UploadRecordsPage'));
const SettingsPage = lazy(() => import('./settings/SettingsPage'));
const EmptyPage = lazy(() => import('./shared/EmptyPage'));

type ScreenRouterProps = ScreenPageProps & {
  screenId: string;
};

export default function ScreenRouter({ screenId, onNavigate, ...pageProps }: ScreenRouterProps) {
  let element: ReactNode = null;

  switch (screenId) {
    case 'patient-dashboard':
      element = <PatientDashboardPage {...pageProps} onNavigate={onNavigate} />;
      break;
    case 'upload-records':
      element = <UploadRecordsPage {...pageProps} onNavigate={onNavigate} />;
      break;
    case 'my-requests':
      element = <MyRequestsPage {...pageProps} onNavigate={onNavigate} />;
      break;
    case 'doctor-list':
    case 'doctor-profile':
      element = <DoctorsPage />;
      break;
    case 'payments':
    case 'subscriptions':
      element = <PaymentsPage />;
      break;
    case 'notifications':
      element = <NotificationsPage />;
      break;
    case 'timeline':
    case 'ai-insights':
      element = <TimelinePage />;
      break;
    case 'case-review':
    case 'doctor-dashboard':
    case 'doctor-analytics':
      element = <DoctorDashboardPage {...pageProps} onNavigate={onNavigate} />;
      break;
    case 'availability':
      element = <SettingsPage {...pageProps} />;
      break;
    case 'doctor-consultation':
      element = <DoctorConsultationPage {...pageProps} onNavigate={onNavigate} />;
      break;
    case 'admin-dashboard':
    case 'admin-analytics':
      element = <AdminDashboardPage />;
      break;
    case 'user-management':
    case 'fraud-monitoring':
      element = <UserManagementPage />;
      break;
    case 'cms':
    case 'audit':
      element = <CmsAuditPage />;
      break;
    case 'settings':
      element = <SettingsPage {...pageProps} />;
      break;
    default:
      element = <EmptyPage />;
  }

  return <Suspense fallback={<ElixPreloader label='Loading…' />}>{element}</Suspense>;
}

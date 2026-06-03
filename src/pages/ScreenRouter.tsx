import AdminDashboardPage from './admin/AdminDashboardPage';
import CmsAuditPage from './admin/CmsAuditPage';
import UserManagementPage from './admin/UserManagementPage';
import AvailabilityPage from './doctor/AvailabilityPage';
import CaseReviewPage from './doctor/CaseReviewPage';
import DoctorConsultationPage from './doctor/DoctorConsultationPage';
import DoctorDashboardPage from './doctor/DoctorDashboardPage';
import DoctorsPage from './patient/DoctorsPage';
import MyRequestsPage from './patient/MyRequestsPage';
import NotificationsPage from './patient/NotificationsPage';
import PatientDashboardPage from './patient/PatientDashboardPage';
import PaymentsPage from './patient/PaymentsPage';
import TimelinePage from './patient/TimelinePage';
import UploadRecordsPage from './patient/UploadRecordsPage';
import SettingsPage from './settings/SettingsPage';
import EmptyPage from './shared/EmptyPage';
import type { ScreenPageProps } from './types';

type ScreenRouterProps = ScreenPageProps & {
  screenId: string;
};

export default function ScreenRouter({ screenId, onNavigate, ...pageProps }: ScreenRouterProps) {
  switch (screenId) {
    case 'patient-dashboard':
      return <PatientDashboardPage {...pageProps} onNavigate={onNavigate} />;
    case 'upload-records':
      return <UploadRecordsPage {...pageProps} />;
    case 'my-requests':
      return <MyRequestsPage {...pageProps} />;
    case 'doctor-list':
    case 'doctor-profile':
      return <DoctorsPage />;
    case 'payments':
    case 'subscriptions':
      return <PaymentsPage />;
    case 'notifications':
      return <NotificationsPage />;
    case 'timeline':
    case 'ai-insights':
      return <TimelinePage />;
    case 'case-review':
      return <CaseReviewPage {...pageProps} onNavigate={onNavigate} />;
    case 'doctor-consultation':
      return <DoctorConsultationPage {...pageProps} onNavigate={onNavigate} />;
    case 'doctor-dashboard':
    case 'doctor-analytics':
      return <DoctorDashboardPage {...pageProps} onNavigate={onNavigate} />;
    case 'availability':
      return <AvailabilityPage />;
    case 'admin-dashboard':
    case 'admin-analytics':
      return <AdminDashboardPage />;
    case 'user-management':
    case 'fraud-monitoring':
      return <UserManagementPage />;
    case 'cms':
    case 'audit':
      return <CmsAuditPage />;
    case 'settings':
      return <SettingsPage {...pageProps} />;
    default:
      return <EmptyPage />;
  }
}

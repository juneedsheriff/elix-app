import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bell,
  ChevronRight,
  Clock,
  FolderOpen,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  Upload
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PatientConsultationRetainCard, {
  isUpcomingPatientConsultation
} from '../../components/ConsultationWorkflow/PatientConsultationRetainCard';
import PatientRequestListCard from '../../components/OpinionRequests/PatientRequestListCard';
import '../../components/OpinionRequests/patient-my-requests.css';
import SecondOpinionChoiceModal from '../../components/OpinionRequests/SecondOpinionChoiceModal';
import { appScreenPath } from '../../lib/navigation/appRoutes';
import { isPatientProfileComplete, patientProfileMissingFields } from '../../lib/patientProfileCompleteness';
import { splitPatientFullName } from '../../lib/patients';
import {
  fetchPatientOpinionRequests,
  isAwaitingDoctorReply,
  subscribePatientOpinionRequestUpdates
} from '../../lib/opinionRequests';
import { fetchUserMedicalRecords } from '../../lib/records';
import type { OpinionRequest } from '../../types/opinionRequest';
import type { ScreenPageProps } from '../types';
import './patient-dashboard.css';

function formatRequestDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString();
}

function averageResponseTime(requests: OpinionRequest[]): string | null {
  const answered = requests.filter((r) => r.responded_at && r.created_at);
  if (!answered.length) return null;

  const totalMs = answered.reduce(
    (sum, r) => sum + (new Date(r.responded_at!).getTime() - new Date(r.created_at).getTime()),
    0
  );
  const avgMs = totalMs / answered.length;
  const mins = Math.round(avgMs / 60000);
  if (mins < 60) return `${mins} min`;
  const hours = (mins / 60).toFixed(1);
  return `${hours} hr`;
}

function patientGreetingName(fullName: string | undefined | null): string {
  if (!fullName?.trim()) return 'there';
  return splitPatientFullName(fullName).firstName || fullName.trim().split(/\s+/)[0] || 'there';
}

type PatientDashboardPageProps = ScreenPageProps & {
  onNavigate?: (screenId: string) => void;
};

export default function PatientDashboardPage({
  userId,
  dbConnected,
  patientProfile,
  onNavigate,
  onRequestProfileSetup
}: PatientDashboardPageProps) {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<OpinionRequest[]>([]);
  const [recordCount, setRecordCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [choiceModalOpen, setChoiceModalOpen] = useState(false);
  const hasLoadedOnceRef = useRef(false);

  const goToScreen = useCallback(
    (screenId: string, search?: string) => {
      onNavigate?.(screenId);
      const path = search ? `${appScreenPath(screenId)}?${search}` : appScreenPath(screenId);
      navigate(path);
    },
    [navigate, onNavigate]
  );

  const openRequest = useCallback(
    (requestId: string) => {
      onNavigate?.('my-requests');
      navigate(`${appScreenPath('my-requests')}?id=${encodeURIComponent(requestId)}`);
    },
    [navigate, onNavigate]
  );

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!userId) {
        setRequests([]);
        setRecordCount(0);
        setLoading(false);
        hasLoadedOnceRef.current = false;
        return;
      }

      const silent = options?.silent ?? hasLoadedOnceRef.current;

      if (!silent) {
        setLoading(true);
        setError(null);
      }

      const [requestsResult, recordsResult] = await Promise.all([
        fetchPatientOpinionRequests(userId),
        fetchUserMedicalRecords(userId)
      ]);

      if (requestsResult.error) {
        if (!silent) {
          setError(requestsResult.error.message);
          setRequests([]);
        }
      } else {
        setRequests(requestsResult.data ?? []);
        if (!silent) setError(null);
      }

      if (!recordsResult.error) {
        setRecordCount(recordsResult.data?.length ?? 0);
      }

      hasLoadedOnceRef.current = true;
      setLoading(false);
    },
    [userId]
  );

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    void load();
  }, [load]);

  useEffect(() => {
    if (!userId || !dbConnected) return;
    return subscribePatientOpinionRequestUpdates(userId, () => void load({ silent: true }));
  }, [userId, dbConnected, load]);

  const openRequests = requests.filter(isAwaitingDoctorReply);
  const doctorReplies = requests.filter((r) => !isAwaitingDoctorReply(r));
  const needsDoctorChoice = requests.filter((r) => r.consultation_stage === 'recommended');
  const documentsVerified = requests.filter(
    (r) =>
      r.records_verified_at &&
      (!r.consultation_stage || r.consultation_stage === 'new' || r.consultation_stage === 'assigned')
  );
  const avgReply = averageResponseTime(requests);
  const recent = requests.slice(0, 3);
  const upcomingConsultations = useMemo(
    () => requests.filter(isUpcomingPatientConsultation),
    [requests]
  );

  const greetingName = patientGreetingName(patientProfile?.full_name);
  const profileIncomplete = Boolean(patientProfile && !isPatientProfileComplete(patientProfile));
  const missingProfileFields = patientProfileMissingFields(patientProfile);

  const metrics = [
    {
      label: 'Open requests',
      value: loading ? '…' : String(openRequests.length),
      hint: loading
        ? 'Loading…'
        : openRequests.length
          ? 'Awaiting care team'
          : requests.length
            ? 'All caught up'
            : 'None yet',
      icon: Activity
    },
    {
      label: 'Doctor replies',
      value: loading ? '…' : String(doctorReplies.length),
      hint: loading
        ? 'Loading…'
        : doctorReplies.length
          ? `${doctorReplies.length} received`
          : 'No replies yet',
      icon: Bell
    },
    {
      label: 'Medical records',
      value: loading ? '…' : String(recordCount),
      hint: loading ? 'Loading…' : 'In your vault',
      icon: FolderOpen
    },
    {
      label: 'Avg response',
      value: loading ? '…' : avgReply ?? '—',
      hint: loading
        ? 'Loading…'
        : avgReply
          ? `${doctorReplies.length} case${doctorReplies.length === 1 ? '' : 's'}`
          : 'Not enough data',
      icon: Clock
    }
  ];

  return (
    <div className='pd-dashboard screen-grid'>
      <SecondOpinionChoiceModal
        open={choiceModalOpen}
        onClose={() => setChoiceModalOpen(false)}
        onSelfSelect={() => {
          setChoiceModalOpen(false);
          goToScreen('doctor-list');
        }}
        onGetRecommendations={() => {
          setChoiceModalOpen(false);
          goToScreen('my-requests', 'flow=recommendations');
        }}
      />

      {profileIncomplete ? (
        <div className='pd-profile-incomplete' role='status'>
          <div>
            <strong>Profile incomplete</strong>
            <p>
              Add {missingProfileFields.join(', ')} so specialists have your full health context.
            </p>
          </div>
          <button type='button' className='primary-btn' onClick={onRequestProfileSetup}>
            Complete profile
          </button>
        </div>
      ) : null}

      <div className='pd-dashboard__shell'>
        <header className='pd-hero'>
          <div className='pd-hero__inner'>
            <div className='pd-hero__content'>
              <p className='pd-hero__eyebrow'>Welcome back</p>
              <h1 className='pd-hero__title'>Hi, {greetingName}</h1>
           
            </div>
            {patientProfile?.elix_id ? (
              <span className='pd-hero__badge'>{patientProfile.elix_id}</span>
            ) : null}
          </div>
        </header>

        <section className='pd-actions' aria-label='Quick actions'>
          <button
            type='button'
            className='pd-action pd-action--primary'
            onClick={() => onNavigate?.('upload-records')}
          >
            <span className='pd-action__icon' aria-hidden>
              <Upload size={20} strokeWidth={2} />
            </span>
            <span className='pd-action__text'>
              <strong>Upload records</strong>
              <small>Add files to your secure vault</small>
            </span>
            <ChevronRight size={18} className='pd-action__chevron' aria-hidden />
          </button>
          <button type='button' className='pd-action' onClick={() => setChoiceModalOpen(true)}>
            <span className='pd-action__icon' aria-hidden>
              <Stethoscope size={20} strokeWidth={2} />
            </span>
            <span className='pd-action__text'>
              <strong>Doctor consultation</strong>
              <small>Choose a doctor or get recommendations</small>
            </span>
            <ChevronRight size={18} className='pd-action__chevron' aria-hidden />
          </button>
        </section>

        {!dbConnected ? (
          <div className='pd-alert pd-alert--error' role='alert'>
            <p className='pd-alert__body'>
              ElixClinix is not configured. Add credentials in <code>.env.local</code> to load live stats.
            </p>
          </div>
        ) : null}

        {error ? (
          <div className='pd-alert pd-alert--error' role='alert'>
            <p className='pd-alert__body'>{error}</p>
          </div>
        ) : null}

        {!loading && documentsVerified.length > 0 ? (
          <div className='pd-alert pd-alert--info'>
            <div className='pd-alert__head'>
              <span className='pd-alert__icon' aria-hidden>
                <ShieldCheck size={16} />
              </span>
              <div>
                <p className='pd-alert__title'>Documents verified</p>
                <p className='pd-alert__body'>
                  {documentsVerified.length === 1
                    ? 'Your records passed review. Doctor recommendations are coming soon.'
                    : `${documentsVerified.length} requests have verified documents — watch for recommendations.`}
                </p>
              </div>
            </div>
            <button type='button' className='primary-btn wide' onClick={() => onNavigate?.('my-requests')}>
              View my requests
            </button>
          </div>
        ) : null}

        {!loading && needsDoctorChoice.length > 0 ? (
          <div className='pd-alert pd-alert--warn'>
            <div className='pd-alert__head'>
              <span className='pd-alert__icon' aria-hidden>
                <Stethoscope size={16} />
              </span>
              <div>
                <p className='pd-alert__title'>Action required</p>
                <p className='pd-alert__body'>
                  {needsDoctorChoice.length === 1
                    ? 'One request is waiting for you to choose a doctor.'
                    : `${needsDoctorChoice.length} requests need your doctor selection.`}
                </p>
              </div>
            </div>
            <button type='button' className='primary-btn wide' onClick={() => onNavigate?.('my-requests')}>
              Choose a doctor
            </button>
          </div>
        ) : null}

        <section className='pd-panel' aria-labelledby='pd-metrics-heading'>
          <div className='pd-panel__head'>
            <div className='pd-panel__head-text'>
              <h2 id='pd-metrics-heading'>Overview</h2>
              <p>Live snapshot of your care journey</p>
            </div>
            {!loading && userId ? (
              <button
                type='button'
                className='pd-panel__refresh'
                onClick={() => void load()}
                aria-label='Refresh dashboard stats'
              >
                <RefreshCw size={13} aria-hidden />
                Refresh
              </button>
            ) : null}
          </div>
          <div className='pd-metrics'>
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <article key={metric.label} className='pd-metric'>
                  <div className='pd-metric__head'>
                    <span className='pd-metric__icon' aria-hidden>
                      <Icon size={15} strokeWidth={2} />
                    </span>
                    <span className='pd-metric__label'>{metric.label}</span>
                  </div>
                  <p className='pd-metric__value'>{metric.value}</p>
                  <p className='pd-metric__hint'>{metric.hint}</p>
                </article>
              );
            })}
          </div>
        </section>

        {loading ? (
          <p className='pd-loading'>
            <Loader2 size={18} className='spin' aria-hidden /> Loading your dashboard…
          </p>
        ) : null}

        {!loading && upcomingConsultations.length > 0 ? (
          <section className='pd-consultations' aria-labelledby='pd-consultations-heading'>
            <div className='pd-consultations__head'>
              <h2 id='pd-consultations-heading'>Active consultation</h2>
              <p>Your upcoming visit at a glance</p>
            </div>
            <ul className='pd-consultations__list'>
              {upcomingConsultations.map((request) => (
                <li key={request.id} className='pd-consultations__item'>
                  <PatientConsultationRetainCard
                    request={request}
                    onOpen={openRequest}
                    onPaymentProofSubmitted={() => void load({ silent: true })}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

       
      </div>
    </div>
  );
}

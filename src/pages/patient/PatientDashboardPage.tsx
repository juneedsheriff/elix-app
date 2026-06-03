import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PatientConsultationRetainCard, {
  hasRetainedConsultationDetails
} from '../../components/ConsultationWorkflow/PatientConsultationRetainCard';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { appScreenPath } from '../../lib/navigation/appRoutes';
import { Activity, Bell, Clock, FolderOpen } from '../../navIcons';
import MetricCard from '../../components/ui/MetricCard';
import SectionCard from '../../components/ui/SectionCard';
import { formatPatientAvailability } from '../../lib/doctorSchedule';
import {
  fetchPatientOpinionRequests,
  isAwaitingDoctorReply,
  patientRequestStatusLabel,
  subscribePatientOpinionRequestUpdates
} from '../../lib/opinionRequests';
import { fetchUserMedicalRecords } from '../../lib/records';
import type { OpinionRequest } from '../../types/opinionRequest';
import type { ScreenPageProps } from '../types';

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

type PatientDashboardPageProps = ScreenPageProps & {
  onNavigate?: (screenId: string) => void;
};

export default function PatientDashboardPage({
  userId,
  dbConnected,
  patientProfile,
  onNavigate
}: PatientDashboardPageProps) {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<OpinionRequest[]>([]);
  const [recordCount, setRecordCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

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
  const consultationsWithDetails = useMemo(
    () => requests.filter(hasRetainedConsultationDetails),
    [requests]
  );

  return (
    <div className='screen-grid'>
      <SectionCard
        title='Patient Command Center'
        subtitle={
          patientProfile?.elix_id
            ? `Patient ID ${patientProfile.elix_id} • Track every opinion request in one place`
            : 'Track every opinion request in one place'
        }
      >
        {!dbConnected ? (
          <p className='auth-error' role='alert'>
            Connect Supabase in <code>.env.local</code> to load live stats.
          </p>
        ) : null}

        {error ? (
          <p className='auth-error' role='alert'>
            {error}
          </p>
        ) : null}

        <div className='metrics-grid'>
          <MetricCard
            title='Open requests'
            value={loading ? '…' : String(openRequests.length)}
            subtitle={
              loading
                ? 'Loading…'
                : openRequests.length
                  ? 'Waiting for doctor opinion'
                  : requests.length
                    ? `${requests.length} request${requests.length === 1 ? '' : 's'} — all have replies`
                    : 'No open requests'
            }
            icon={Activity}
          />
          <MetricCard
            title='Doctor replies'
            value={loading ? '…' : String(doctorReplies.length)}
            subtitle={
              loading
                ? 'Loading…'
                : doctorReplies.length
                  ? `${doctorReplies.length} response${doctorReplies.length === 1 ? '' : 's'} received`
                  : 'No replies yet'
            }
            icon={Bell}
          />
          <MetricCard
            title='Medical records'
            value={loading ? '…' : String(recordCount)}
            subtitle={loading ? 'Loading…' : 'Files in your vault'}
            icon={FolderOpen}
          />
          <MetricCard
            title='Avg response time'
            value={loading ? '…' : avgReply ?? '—'}
            subtitle={
              loading
                ? 'Loading…'
                : avgReply
                  ? `Across ${doctorReplies.length} completed case${doctorReplies.length === 1 ? '' : 's'}`
                  : 'No completed cases yet'
            }
            icon={Clock}
          />
        </div>

        {!loading && userId ? (
          <button type='button' className='text-btn patient-dashboard-refresh' onClick={() => void load()}>
            Refresh stats
          </button>
        ) : null}
      </SectionCard>

      {!loading && documentsVerified.length > 0 ? (
        <SectionCard title='Documents verified' subtitle='Your records passed review'>
          <p className='muted' style={{ marginTop: 0 }}>
            {documentsVerified.length === 1
              ? 'Your uploaded documents are verified. Doctor recommendations are coming soon.'
              : `${documentsVerified.length} requests have verified documents — watch for doctor recommendations.`}
          </p>
          <button type='button' className='primary-btn wide' onClick={() => onNavigate?.('my-requests')}>
            View my requests
          </button>
        </SectionCard>
      ) : null}

      {!loading && consultationsWithDetails.length > 0 ? (
        <div className='patient-dashboard-consultations'>
          {consultationsWithDetails.map((request) => (
            <div key={request.id} className='patient-dashboard-consultation-item'>
              <button
                type='button'
                className='text-btn patient-dashboard-consultation-open'
                onClick={() =>
                  navigate(`${appScreenPath('my-requests')}?id=${encodeURIComponent(request.id)}`)
                }
              >
                Open request →
              </button>
              <PatientConsultationRetainCard
                request={request}
                onPaymentProofSubmitted={() => void load({ silent: true })}
              />
            </div>
          ))}
        </div>
      ) : null}

      {!loading && needsDoctorChoice.length > 0 ? (
        <SectionCard
          title='Action required'
          subtitle='Your care team shared doctor recommendations'
        >
          <p className='muted' style={{ marginTop: 0 }}>
            {needsDoctorChoice.length === 1
              ? 'One opinion request is waiting for you to choose a doctor.'
              : `${needsDoctorChoice.length} opinion requests are waiting for you to choose a doctor.`}
          </p>
          <button type='button' className='primary-btn wide' onClick={() => onNavigate?.('my-requests')}>
            Choose a doctor
          </button>
        </SectionCard>
      ) : null}

      <SectionCard title='Recent opinion requests' subtitle='Latest activity from your doctors'>
        {loading ? (
          <p className='doctor-status'>
            <Loader2 size={18} className='spin' aria-hidden /> Loading…
          </p>
        ) : null}

        {!loading && !userId ? (
          <p className='muted'>Sign in to see your opinion requests.</p>
        ) : null}

        {!loading && userId && recent.length === 0 ? (
          <p className='muted'>No requests yet. Browse doctors and tap Get opinion to start.</p>
        ) : null}

        {!loading && recent.length > 0 ? (
          <>
            <ul className='list doctor-dashboard-queue patient-dashboard-recent'>
              {recent.map((request) => (
                <li key={request.id}>
                  <button
                    type='button'
                    className='patient-request-row patient-request-row--compact'
                    onClick={() =>
                      navigate(`${appScreenPath('my-requests')}?id=${encodeURIComponent(request.id)}`)
                    }
                  >
                    <div className='patient-request-row-main'>
                      <strong>{request.doctor_name ?? 'Doctor'}</strong>
                      {request.doctor_specialty ? (
                        <span className='patient-request-row-specialty'>{request.doctor_specialty}</span>
                      ) : null}
                      <div className='patient-request-row-badges'>
                        {request.records_verified_at ? (
                          <span className='patient-docs-verified-badge patient-docs-verified-badge--inline'>
                            Verified
                          </span>
                        ) : null}
                        {request.payment_status === 'paid' ? (
                          <span className='patient-payment-confirmed-badge'>Payment confirmed</span>
                        ) : null}
                        <span className={`tag status-${request.status}`}>
                          {patientRequestStatusLabel(request)}
                        </span>
                      </div>
                    </div>
                    <span className='patient-request-row-time'>
                      {formatRequestDate(request.created_at)}
                      {request.records.length
                        ? ` • ${request.records.length} file${request.records.length === 1 ? '' : 's'}`
                        : ''}
                    </span>
                    {formatPatientAvailability(request.patient_availability) ? (
                      <span className='patient-request-row-meta'>
                        Preferred: {formatPatientAvailability(request.patient_availability).split('\n')[0]}
                      </span>
                    ) : null}
                    {request.payment_status === 'paid' && request.payment_confirmed_at ? (
                      <span className='patient-request-row-meta'>
                        Paid {new Date(request.payment_confirmed_at).toLocaleString()}
                        {request.payment_amount != null
                          ? ` · ${request.payment_amount} ${request.payment_currency ?? 'USD'}`
                          : ''}
                      </span>
                    ) : null}
                  </button>
                  {request.consultation_stage === 'recommended' ? (
                    <button
                      type='button'
                      className='text-btn'
                      style={{ marginTop: '0.35rem' }}
                      onClick={() =>
                        navigate(`${appScreenPath('my-requests')}?id=${encodeURIComponent(request.id)}`)
                      }
                    >
                      Choose recommended doctor →
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            <button type='button' className='primary-btn wide' onClick={() => onNavigate?.('my-requests')}>
              View all requests
            </button>
          </>
        ) : null}
      </SectionCard>

      <SectionCard title='Quick actions' subtitle='Manage your health workspace'>
        <div className='tag-row patient-dashboard-actions'>
          <button type='button' className='primary-btn' onClick={() => onNavigate?.('upload-records')}>
            Upload records
          </button>
          <button type='button' className='secondary-btn' onClick={() => onNavigate?.('doctor-list')}>
            Find a doctor
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

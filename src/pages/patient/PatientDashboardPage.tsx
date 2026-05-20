import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Activity, Bell, Clock, FolderOpen } from '../../navIcons';
import MetricCard from '../../components/ui/MetricCard';
import SectionCard from '../../components/ui/SectionCard';
import { fetchPatientOpinionRequests, isAwaitingDoctorReply } from '../../lib/opinionRequests';
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

export default function PatientDashboardPage({ userId, dbConnected, onNavigate }: PatientDashboardPageProps) {
  const [requests, setRequests] = useState<OpinionRequest[]>([]);
  const [recordCount, setRecordCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setRequests([]);
      setRecordCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [requestsResult, recordsResult] = await Promise.all([
      fetchPatientOpinionRequests(userId),
      fetchUserMedicalRecords(userId)
    ]);

    if (requestsResult.error) {
      setError(requestsResult.error.message);
      setRequests([]);
    } else {
      setRequests(requestsResult.data ?? []);
    }

    if (!recordsResult.error) {
      setRecordCount(recordsResult.data?.length ?? 0);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openRequests = requests.filter(isAwaitingDoctorReply);
  const doctorReplies = requests.filter((r) => !isAwaitingDoctorReply(r));
  const avgReply = averageResponseTime(requests);
  const recent = requests.slice(0, 3);

  return (
    <div className='screen-grid'>
      <SectionCard title='Patient Command Center' subtitle='Track every opinion request in one place'>
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
            <ul className='list doctor-dashboard-queue'>
              {recent.map((request) => (
                <li key={request.id}>
                  <strong>{request.doctor_name ?? 'Doctor'}</strong>
                  <span>
                    {request.doctor_response ? 'Reply received' : 'Awaiting reply'}
                    {' • '}
                    {formatRequestDate(request.created_at)}
                  </span>
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

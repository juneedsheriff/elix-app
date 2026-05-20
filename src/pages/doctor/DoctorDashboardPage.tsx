import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Loader2 } from 'lucide-react';
import MetricCard from '../../components/ui/MetricCard';
import SectionCard from '../../components/ui/SectionCard';
import { fetchDoctorOpinionRequests, isAwaitingDoctorReply } from '../../lib/opinionRequests';
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

function statusSummary(status: string, hasResponse: boolean): string {
  if (hasResponse || status === 'closed') return 'Response sent';
  if (status === 'in_review') return 'In review';
  return 'Awaiting your response';
}

type DoctorDashboardPageProps = ScreenPageProps & {
  onNavigate?: (screenId: string) => void;
};

export default function DoctorDashboardPage({ doctorProfile, dbConnected, onNavigate }: DoctorDashboardPageProps) {
  const [requests, setRequests] = useState<OpinionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!dbConnected) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await fetchDoctorOpinionRequests();
    if (fetchError) {
      setError(fetchError.message);
      setRequests([]);
    } else {
      setRequests(data ?? []);
    }
    setLoading(false);
  }, [dbConnected]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = requests.filter(isAwaitingDoctorReply);
  const awaitingResponse = pending;
  const recent = requests.slice(0, 5);
  const rating = doctorProfile?.rating?.toFixed(1) ?? '—';

  return (
    <div className='screen-grid'>
      <SectionCard title='Doctor operating console' subtitle='Prioritize urgent cases and maximize quality outcomes'>
        <div className='metrics-grid'>
          <MetricCard
            title='Pending reviews'
            value={loading ? '…' : String(pending.length)}
            subtitle={
              loading
                ? 'Loading…'
                : pending.length
                  ? `${pending.length} need your written opinion`
                  : 'No open cases'
            }
          />
          <MetricCard
            title='Total requests'
            value={loading ? '…' : String(requests.length)}
            subtitle='Incoming second opinions'
          />
          <MetricCard
            title='Awaiting response'
            value={loading ? '…' : String(awaitingResponse.length)}
            subtitle='Patients waiting for your reply'
          />
          <MetricCard
            title='Patient rating'
            value={rating}
            subtitle={doctorProfile ? 'From your Elix profile' : 'Sign in to load profile'}
          />
        </div>
      </SectionCard>

      <SectionCard title='Case queue' subtitle='Latest incoming requests from patients'>
        {loading ? (
          <p className='doctor-status'>
            <Loader2 size={18} className='spin' aria-hidden /> Loading requests…
          </p>
        ) : null}

        {error ? (
          <p className='auth-error' role='alert'>
            {error}
          </p>
        ) : null}

        {!loading && !error && recent.length === 0 ? (
          <p className='muted'>No incoming requests yet. Patients send cases from a doctor profile → Get opinion.</p>
        ) : null}

        {!loading && !error && recent.length > 0 ? (
          <>
            <ul className='list doctor-dashboard-queue'>
              {recent.map((request) => (
                <li key={request.id}>
                  <strong>
                    {request.patient_name ?? 'Patient'}
                    {request.doctor_specialty ? ` • ${request.doctor_specialty}` : ''}
                  </strong>
                  <span>
                    {statusSummary(request.status, Boolean(request.doctor_response))}
                    {' • '}
                    {request.records.length} file{request.records.length === 1 ? '' : 's'}
                    {' • '}
                    {formatRequestDate(request.created_at)}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type='button'
              className='primary-btn wide doctor-dashboard-cta'
              onClick={() => onNavigate?.('case-review')}
            >
              <ClipboardList size={18} aria-hidden />
              {pending.length > 0
                ? `Respond to ${pending.length} pending request${pending.length === 1 ? '' : 's'}`
                : 'View all incoming requests'}
            </button>
          </>
        ) : null}
      </SectionCard>
    </div>
  );
}

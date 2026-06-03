import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, Loader2 } from 'lucide-react';
import PatientRequestDetail from './PatientRequestDetail';
import PatientRequestListCard from './PatientRequestListCard';
import {
  fetchPatientOpinionRequests,
  subscribePatientOpinionRequestUpdates
} from '../../lib/opinionRequests';
import { getMedicalRecordDownloadUrl } from '../../lib/records';
import './patient-my-requests.css';

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

type PatientMyRequestsProps = {
  patientAuthUserId: string | null | undefined;
  configured: boolean;
};

export default function PatientMyRequests({ patientAuthUserId, configured }: PatientMyRequestsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('id');

  const [requests, setRequests] = useState<OpinionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [liveTick, setLiveTick] = useState(0);
  const hasLoadedOnceRef = useRef(false);

  const canLoad = Boolean(patientAuthUserId);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!canLoad) {
        setRequests([]);
        setLoading(false);
        hasLoadedOnceRef.current = false;
        return;
      }

      const silent = options?.silent ?? hasLoadedOnceRef.current;

      if (!silent) {
        setLoading(true);
        setError(null);
      }

      const result = await fetchPatientOpinionRequests(patientAuthUserId!);

      if (result.error) {
        if (!silent) {
          setError(result.error.message);
          setRequests([]);
        }
      } else {
        setRequests(result.data ?? []);
        if (!silent) setError(null);
        setLiveTick((tick) => tick + 1);
      }

      hasLoadedOnceRef.current = true;
      setLoading(false);
    },
    [canLoad, patientAuthUserId]
  );

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    void load();
  }, [load]);

  const selectedRequest = selectedId ? requests.find((request) => request.id === selectedId) : null;

  useEffect(() => {
    if (!canLoad || !patientAuthUserId) return;
    return subscribePatientOpinionRequestUpdates(patientAuthUserId, () => void load({ silent: true }));
  }, [canLoad, patientAuthUserId, load]);

  const openDetail = (requestId: string) => {
    setSearchParams({ id: requestId });
    setActionMessage(null);
    setSuccessMessage(null);
  };

  const closeDetail = () => {
    setSearchParams({});
  };

  const openRecord = async (storagePath: string | null) => {
    if (!storagePath) {
      setActionMessage('File path missing for this record.');
      return;
    }
    const { data, error: urlError } = await getMedicalRecordDownloadUrl(storagePath);
    if (urlError || !data?.signedUrl) {
      setActionMessage(urlError?.message ?? 'Could not open file.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleMessage = (message: string, type: 'error' | 'success') => {
    if (type === 'error') {
      setActionMessage(message);
      setSuccessMessage(null);
    } else {
      setSuccessMessage(message);
      setActionMessage(null);
    }
  };

  if (selectedId) {
    if (loading && !hasLoadedOnceRef.current) {
      return (
        <div className='screen-grid doctors-screen'>
          <section className='section-card'>
            <p className='doctor-status' aria-live='polite'>
              <Loader2 size={18} className='spin' aria-hidden /> Loading request…
            </p>
          </section>
        </div>
      );
    }

    if (!selectedRequest) {
      return (
        <div className='screen-grid doctors-screen'>
          <section className='section-card'>
            <p className='auth-error' role='alert'>
              Request not found.
            </p>
            <button type='button' className='text-btn' onClick={closeDetail}>
              Back to requests
            </button>
          </section>
        </div>
      );
    }

    return (
      <div className='screen-grid doctors-screen patient-request-detail-view'>
        <section className='section-card patient-request-detail-view__card'>
          {actionMessage ? (
            <p className='auth-error' role='status'>
              {actionMessage}
            </p>
          ) : null}
          {successMessage ? (
            <p className='muted' role='status'>
              {successMessage}
            </p>
          ) : null}
          <PatientRequestDetail
            request={selectedRequest}
            liveTick={liveTick}
            onBack={closeDetail}
            onUpdated={() => void load({ silent: true })}
            onOpenRecord={(path) => void openRecord(path)}
            onMessage={handleMessage}
          />
        </section>
      </div>
    );
  }

  return (
    <div className='screen-grid doctors-screen patient-my-requests'>
      <section className='pmr-shell'>
        <header className='pmr-hero'>
          <div className='pmr-hero__icon' aria-hidden>
            <ClipboardList size={22} strokeWidth={2} />
          </div>
          <div className='pmr-hero__text'>
            <h2 className='pmr-hero__title'>My requests</h2>
            <p className='pmr-hero__subtitle'>
              Track consultations, payments, and doctor responses in one place.
            </p>
          </div>
          {!loading && requests.length > 0 ? (
            <span className='pmr-hero__count' aria-label={`${requests.length} requests`}>
              {requests.length}
            </span>
          ) : null}
        </header>

        {!configured ? (
          <p className='pmr-alert pmr-alert--error' role='alert'>
            Connect Supabase in <code>.env.local</code> to load requests.
          </p>
        ) : null}

        {!canLoad ? (
          <p className='pmr-empty__text' style={{ textAlign: 'center', margin: 0 }}>
            Sign in as a patient to view your requests.
          </p>
        ) : null}

        {loading ? (
          <div className='pmr-skeleton-list' aria-live='polite' aria-busy='true'>
            <div className='pmr-skeleton-card' />
            <div className='pmr-skeleton-card' />
            <div className='pmr-skeleton-card' />
            <span className='pmr-loading' style={{ justifyContent: 'center', marginTop: '0.5rem' }}>
              <Loader2 size={18} className='spin' aria-hidden /> Loading requests…
            </span>
          </div>
        ) : null}

        {error ? (
          <p className='pmr-alert pmr-alert--error' role='alert'>
            {error}
          </p>
        ) : null}

        {actionMessage ? (
          <p className='pmr-alert pmr-alert--error' role='status'>
            {actionMessage}
          </p>
        ) : null}

        {successMessage ? (
          <p className='pmr-alert pmr-alert--success' role='status'>
            {successMessage}
          </p>
        ) : null}

        {!loading && !error && canLoad && requests.length === 0 ? (
          <div className='pmr-empty'>
            <div className='pmr-empty__icon' aria-hidden>
              <ClipboardList size={28} strokeWidth={1.75} />
            </div>
            <p className='pmr-empty__title'>No requests yet</p>
            <p className='pmr-empty__text'>
              Browse doctors and tap Get opinion to start your first consultation.
            </p>
          </div>
        ) : null}

        {!loading && !error && requests.length > 0 ? (
          <ul className='pmr-list' role='list'>
            {requests.map((request) => (
              <PatientRequestListCard
                key={request.id}
                request={request}
                relativeTime={formatRequestDate(request.created_at)}
                onOpen={openDetail}
              />
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

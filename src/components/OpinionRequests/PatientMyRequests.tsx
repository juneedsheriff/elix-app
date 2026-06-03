import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronRight, ClipboardList, Loader2, Sparkles } from 'lucide-react';
import PatientRequestDetail from './PatientRequestDetail';
import PatientRequestListCard from './PatientRequestListCard';
import RecommendationOpinionForm from './RecommendationOpinionForm';
import SecondOpinionChoiceModal from './SecondOpinionChoiceModal';
import {
  fetchPatientOpinionRequests,
  subscribePatientOpinionRequestUpdates
} from '../../lib/opinionRequests';
import { appScreenPath } from '../../lib/navigation/appRoutes';
import { getMedicalRecordDownloadUrl } from '../../lib/records';
import type { OpinionRequest } from '../../types/opinionRequest';
import './patient-my-requests.css';

function formatRequestDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString();
}

function requestUpdatedIso(request: OpinionRequest): string {
  const candidates = [
    request.created_at,
    request.responded_at,
    request.payment_confirmed_at,
    request.scheduled_at,
    request.records_verified_at
  ].filter((value): value is string => Boolean(value));

  if (!candidates.length) return request.created_at;

  return candidates.reduce((latest, current) =>
    new Date(current).getTime() > new Date(latest).getTime() ? current : latest
  );
}

type PatientMyRequestsProps = {
  patientAuthUserId: string | null | undefined;
  configured: boolean;
  onNavigate?: (screenId: string) => void;
};

export default function PatientMyRequests({
  patientAuthUserId,
  configured,
  onNavigate
}: PatientMyRequestsProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('id');

  const [requests, setRequests] = useState<OpinionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [liveTick, setLiveTick] = useState(0);
  const [choiceModalOpen, setChoiceModalOpen] = useState(false);
  const [showRecommendationForm, setShowRecommendationForm] = useState(false);
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

  useEffect(() => {
    if (searchParams.get('flow') !== 'recommendations') return;
    setShowRecommendationForm(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

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

  const goToScreen = useCallback(
    (screenId: string) => {
      if (onNavigate) {
        onNavigate(screenId);
        return;
      }
      navigate(appScreenPath(screenId));
    },
    [navigate, onNavigate]
  );

  if (showRecommendationForm) {
    return (
      <div className='screen-grid doctors-screen patient-my-requests'>
        <RecommendationOpinionForm
          onBack={() => setShowRecommendationForm(false)}
          onSubmitted={(requestId) => {
            void load({ silent: true });
            setShowRecommendationForm(false);
            openDetail(requestId);
          }}
        />
      </div>
    );
  }

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
      <SecondOpinionChoiceModal
        open={choiceModalOpen}
        onClose={() => setChoiceModalOpen(false)}
        onSelfSelect={() => {
          setChoiceModalOpen(false);
          goToScreen('doctor-list');
        }}
        onGetRecommendations={() => {
          setChoiceModalOpen(false);
          setShowRecommendationForm(true);
        }}
      />

      <div className='pmr-page'>
        <div className='pmr-header-panel'>
          <section className='pmr-hero-banner' aria-labelledby='pmr-hero-heading'>
            <div className='pmr-hero-banner__content'>
              <h2 id='pmr-hero-heading' className='pmr-hero-banner__title'>
                My requests
              </h2>
              <p className='pmr-hero-banner__text'>
                Track consultations, payments, and doctor responses in one place.
              </p>
              <div className='pmr-hero-banner__badges'>
                {!loading && requests.length > 0 ? (
                  <span className='pmr-hero-badge pmr-hero-badge--active'>
                    <Check size={12} strokeWidth={3} aria-hidden />
                    {requests.length} Active
                  </span>
                ) : null}
                <span className='pmr-hero-badge pmr-hero-badge--info'>
                  <Check size={12} strokeWidth={3} aria-hidden />
                  Live status updates
                </span>
              </div>
            </div>
            <div className='pmr-hero-banner__art' aria-hidden>
              <span className='pmr-hero-banner__icon-wrap'>
                <ClipboardList size={32} strokeWidth={1.75} />
              </span>
            </div>
          </section>

          {canLoad ? (
            <button type='button' className='pmr-cta-btn' onClick={() => setChoiceModalOpen(true)}>
              <Sparkles size={18} strokeWidth={2} aria-hidden />
              <span>Get a second opinion</span>
              <ChevronRight size={18} className='pmr-cta-btn__chevron' aria-hidden />
            </button>
          ) : null}

          {!configured ? (
            <p className='pmr-alert pmr-alert--error' role='alert'>
              Connect Supabase in <code>.env.local</code> to load requests.
            </p>
          ) : null}

          {!canLoad ? (
            <p className='pmr-alert'>Sign in as a patient to view your requests.</p>
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
        </div>

        <div className='pmr-body'>
          {loading ? (
            <div className='pmr-skeleton-list' aria-live='polite' aria-busy='true'>
              <div className='pmr-skeleton-card' />
              <div className='pmr-skeleton-card' />
              <div className='pmr-skeleton-card' />
              <span className='pmr-loading'>
                <Loader2 size={18} className='spin' aria-hidden /> Loading requests…
              </span>
            </div>
          ) : null}

          {!loading && !error && canLoad && requests.length === 0 ? (
            <div className='pmr-empty'>
              <div className='pmr-empty__icon' aria-hidden>
                <ClipboardList size={28} strokeWidth={1.75} />
              </div>
              <p className='pmr-empty__title'>No requests yet</p>
              <p className='pmr-empty__text'>
                Tap Get a second opinion to start your first consultation, or browse doctors to choose a
                specialist directly.
              </p>
            </div>
          ) : null}

          {!loading && !error && requests.length > 0 ? (
            <ul className='pmr-list' role='list'>
              {requests.map((request) => (
                <PatientRequestListCard
                  key={request.id}
                  request={request}
                  relativeTime={formatRequestDate(requestUpdatedIso(request))}
                  onOpen={openDetail}
                />
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

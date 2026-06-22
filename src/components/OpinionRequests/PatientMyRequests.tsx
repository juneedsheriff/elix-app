import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronRight,
  ClipboardList,
  Loader2,
  Sparkles
} from 'lucide-react';
import PatientRequestDetail from './PatientRequestDetail';
import PatientRequestListCard from './PatientRequestListCard';
import OpinionRequestActivityPage from './OpinionRequestActivityPage';
import RecommendationOpinionForm from './RecommendationOpinionForm';
import SecondOpinionChoiceModal from './SecondOpinionChoiceModal';
import {
  fetchPatientOpinionRequestById,
  fetchPatientOpinionRequests,
  isPatientRequestCompleted,
  isRecommendationOpinionRequest,
  subscribePatientOpinionRequestUpdates
} from '../../lib/opinionRequests';
import { appScreenPath } from '../../lib/navigation/appRoutes';
import { consumeReturnOpinionRequestId } from '../../lib/navigation/returnOpinionRequest';
import { openMedicalRecordByPath } from '../../lib/records';
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
  const selectedId = searchParams.get('id')?.trim() || null;
  const showActivity = searchParams.get('activity') === '1';

  const [requests, setRequests] = useState<OpinionRequest[]>([]);
  const [detailRequest, setDetailRequest] = useState<OpinionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [liveTick, setLiveTick] = useState(0);
  const [choiceModalOpen, setChoiceModalOpen] = useState(false);
  const [showRecommendationForm, setShowRecommendationForm] = useState(false);
  const [requestTab, setRequestTab] = useState<'upcoming' | 'completed'>('upcoming');
  const hasLoadedOnceRef = useRef(false);

  const { completedRequests, upcomingRequests, showRequestTabs, visibleRequests } = useMemo(() => {
      const completed = requests.filter(isPatientRequestCompleted);
      const upcoming = requests.filter((request) => !isPatientRequestCompleted(request));
      const showTabs = completed.length > 0 && upcoming.length > 0;
      const visible = showTabs
        ? requestTab === 'completed'
          ? completed
          : upcoming
        : upcoming.length > 0
          ? upcoming
          : completed;

      return {
        completedRequests: completed,
        upcomingRequests: upcoming,
        showRequestTabs: showTabs,
        visibleRequests: visible
      };
    }, [requests, requestTab]);

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
    const returnId = consumeReturnOpinionRequestId();
    if (!returnId) return;
    setSearchParams(
      (prev) => {
        if (prev.get('id') === returnId) return prev;
        const next = new URLSearchParams(prev);
        next.set('id', returnId);
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  useEffect(() => {
    if (searchParams.get('flow') !== 'recommendations') return;
    setShowRecommendationForm(true);
    const next = new URLSearchParams(searchParams);
    next.delete('flow');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const selectedRequest = useMemo(() => {
    if (!selectedId) return null;
    return requests.find((request) => request.id === selectedId) ?? detailRequest;
  }, [selectedId, requests, detailRequest]);

  useEffect(() => {
    if (!selectedId || !canLoad || !patientAuthUserId) {
      setDetailRequest(null);
      setDetailLoading(false);
      return;
    }

    if (requests.some((request) => request.id === selectedId)) {
      setDetailRequest(null);
      setDetailLoading(false);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);

    void fetchPatientOpinionRequestById(patientAuthUserId, selectedId).then((result) => {
      if (cancelled) return;
      setDetailLoading(false);
      if (result.error) {
        setDetailRequest(null);
        return;
      }
      setDetailRequest(result.data);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedId, canLoad, patientAuthUserId, requests]);

  useEffect(() => {
    if (!canLoad || !patientAuthUserId) return;
    return subscribePatientOpinionRequestUpdates(patientAuthUserId, () => void load({ silent: true }));
  }, [canLoad, patientAuthUserId, load]);

  const openDetail = (requestId: string) => {
    setSearchParams({ id: requestId });
    setActionMessage(null);
    setSuccessMessage(null);
  };

  const patchRequestCaseDetails = useCallback(
    (requestId: string, patch: { patient_case_details: unknown; message?: string | null; requested_specialty?: string | null }) => {
      const merge = (request: OpinionRequest): OpinionRequest => ({
        ...request,
        patient_case_details: patch.patient_case_details,
        message: patch.message ?? request.message,
        requested_specialty: patch.requested_specialty ?? request.requested_specialty
      });

      setRequests((prev) =>
        prev.map((request) => (request.id === requestId ? merge(request) : request))
      );
      setDetailRequest((prev) => (prev?.id === requestId ? merge(prev) : prev));
    },
    []
  );

  const openActivity = (requestId: string) => {
    setSearchParams({ id: requestId, activity: '1' });
  };

  const closeActivity = () => {
    if (!selectedId) {
      setSearchParams({});
      return;
    }
    setSearchParams({ id: selectedId });
  };

  const closeDetail = () => {
    setDetailRequest(null);
    setSearchParams({});
  };

  const openRecord = async (storagePath: string | null) => {
    if (!storagePath) {
      setActionMessage('File path missing for this record.');
      return;
    }
    const { error: openError } = await openMedicalRecordByPath(storagePath);
    if (openError) {
      setActionMessage(openError.message);
    }
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
          onSubmitted={async (requestId) => {
            setShowRecommendationForm(false);
            await load({ silent: true });
            openDetail(requestId);
          }}
        />
      </div>
    );
  }

  if (selectedId) {
    if (!selectedRequest && (loading || detailLoading)) {
      return (
        <div className='screen-grid doctors-screen patient-request-detail-view'>
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

    if (showActivity) {
      const activityLabel = isRecommendationOpinionRequest(selectedRequest) && !selectedRequest.doctor_name
        ? 'Doctor recommendations'
        : (selectedRequest.doctor_name ?? 'Consultation request');

      return (
        <OpinionRequestActivityPage
          requestId={selectedRequest.id}
          requestLabel={activityLabel}
          refreshKey={liveTick}
          onBack={closeActivity}
          backLabel='Back to request'
        />
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
            onOpenActivity={() => openActivity(selectedRequest.id)}
            onUpdated={() => void load({ silent: true })}
            onRequestPatch={(patch) => patchRequestCaseDetails(selectedRequest.id, patch)}
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
            <div className='pmr-hero-banner__glow' aria-hidden />
            <div className='pmr-hero-banner__inner'>
              <div className='pmr-hero-banner__content'>
                <p className='pmr-hero-banner__eyebrow'>Your consultations</p>
                <h2 id='pmr-hero-heading' className='pmr-hero-banner__title'>
                  My requests
                </h2>
                <p className='pmr-hero-banner__text'>
                  Track consultations, payments, and doctor responses in one place.
                </p>
              </div>
              <div className='pmr-hero-banner__art' aria-hidden>
                <span className='pmr-hero-banner__icon-wrap'>
                  <ClipboardList size={26} strokeWidth={1.75} />
                </span>
              </div>
            </div>
          </section>

          {canLoad ? (
            <button type='button' className='pmr-cta-btn' onClick={() => setChoiceModalOpen(true)}>
              <Sparkles size={18} strokeWidth={2} aria-hidden />
              <span>Get a doctor consultation</span>
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
          {!loading && !error && showRequestTabs ? (
            <div className='pmr-tabs' role='tablist' aria-label='Request categories'>
              <button
                type='button'
                role='tab'
                id='pmr-tab-upcoming'
                aria-selected={requestTab === 'upcoming'}
                aria-controls='pmr-request-panel'
                className={requestTab === 'upcoming' ? 'pmr-tab pmr-tab--active' : 'pmr-tab'}
                onClick={() => setRequestTab('upcoming')}
              >
                Upcoming
                <span className='pmr-tab__count'>{upcomingRequests.length}</span>
              </button>
              <button
                type='button'
                role='tab'
                id='pmr-tab-completed'
                aria-selected={requestTab === 'completed'}
                aria-controls='pmr-request-panel'
                className={requestTab === 'completed' ? 'pmr-tab pmr-tab--active' : 'pmr-tab'}
                onClick={() => setRequestTab('completed')}
              >
                Completed
                <span className='pmr-tab__count'>{completedRequests.length}</span>
              </button>
            </div>
          ) : null}

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
                Tap Get a doctor consultation to start your first consultation, or browse doctors to choose a
                specialist directly.
              </p>
            </div>
          ) : null}

          {!loading && !error && visibleRequests.length > 0 ? (
            <ul
              id='pmr-request-panel'
              className='pmr-list'
              role='list'
              aria-labelledby={showRequestTabs ? `pmr-tab-${requestTab}` : undefined}
            >
              {visibleRequests.map((request) => (
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

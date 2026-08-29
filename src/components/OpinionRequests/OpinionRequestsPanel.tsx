import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Select, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { ClipboardList, Loader2, RefreshCw } from 'lucide-react';
import DoctorGiveConsultationButton from './DoctorGiveConsultationButton';
import DoctorIncomingRequestsCardList from './DoctorIncomingRequestsCardList';
import { canDoctorGiveConsultation } from '../../lib/doctorConsultation';
import {
  fetchDoctorOpinionRequests,
  fetchPatientOpinionRequests,
  isAwaitingDoctorReply,
  isPatientRequestCompleted,
  patientRequestStatusLabel,
  subscribeDoctorOpinionRequestUpdates
} from '../../lib/opinionRequests';
import { isHomeCareOpinionRequest } from '../../lib/homeCareServices';
import type { OpinionRequest } from '../../types/opinionRequest';

const DOCTOR_CASES_POLL_MS = 25_000;

type DoctorCaseStatusFilter = 'all' | 'pending' | 'completed';

function statusLabel(status: string, view: 'patient' | 'doctor', request?: OpinionRequest): string {
  if (view === 'patient' && request) {
    return patientRequestStatusLabel(request);
  }
  if (status === 'in_review') return 'In review';
  if (status === 'closed') return 'Completed';
  return 'Submitted';
}

function matchesDoctorSearch(request: OpinionRequest, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [
    request.patient_name,
    request.patient_email,
    request.message,
    statusLabel(request.status, 'doctor', request)
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalized);
}

type OpinionRequestsPanelProps = {
  view: 'patient' | 'doctor';
  configured: boolean;
  patientAuthUserId?: string | null;
  doctorId?: string | null;
  doctorEmail?: string | null;
  title: string;
  subtitle: string;
  emptyHint: string;
  signInHint: string;
  onNavigate?: (screenId: string) => void;
  doctorReturnScreen?: string;
  /** Request filter mode. */
  requestKind?: 'consultations' | 'homecare' | 'all';
};

export default function OpinionRequestsPanel({
  view,
  configured,
  patientAuthUserId,
  doctorId,
  doctorEmail,
  title,
  subtitle,
  emptyHint,
  signInHint,
  onNavigate,
  doctorReturnScreen = 'case-review',
  requestKind = 'all'
}: OpinionRequestsPanelProps) {
  const location = useLocation();
  const isElixHealthWorkspace =
    view === 'doctor' && location.pathname.startsWith('/elixhealth/workspace');

  const [requests, setRequests] = useState<OpinionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [doctorStatusFilter, setDoctorStatusFilter] = useState<DoctorCaseStatusFilter>('all');
  const hasLoadedOnceRef = useRef(false);

  const canLoad = view === 'patient' ? Boolean(patientAuthUserId) : Boolean(doctorId || doctorEmail);

  const kindFilteredRequests = useMemo(() => {
    if (requestKind === 'all') {
      return requests;
    }
    if (requestKind === 'homecare') {
      return requests.filter(isHomeCareOpinionRequest);
    }
    return requests.filter((request) => !isHomeCareOpinionRequest(request));
  }, [requestKind, requests]);

  const visibleRequests = useMemo(() => {
    let list = kindFilteredRequests;
    if (view === 'doctor' && isElixHealthWorkspace) {
      if (doctorStatusFilter === 'completed') {
        list = list.filter(isPatientRequestCompleted);
      } else if (doctorStatusFilter === 'pending') {
        list = list.filter((request) => !isPatientRequestCompleted(request));
      }
    }
    if (view === 'doctor' && isElixHealthWorkspace && doctorStatusFilter === 'all') {
      list = [...list].sort((a, b) => {
        const aDone = isPatientRequestCompleted(a) ? 1 : 0;
        const bDone = isPatientRequestCompleted(b) ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    if (view !== 'doctor' || !doctorSearch.trim()) return list;
    return list.filter((request) => matchesDoctorSearch(request, doctorSearch));
  }, [doctorSearch, doctorStatusFilter, isElixHealthWorkspace, kindFilteredRequests, view]);

  const doctorConsultationQueue =
    view === 'doctor' ? kindFilteredRequests.filter(canDoctorGiveConsultation) : [];
  const doctorPendingCount = doctorConsultationQueue.filter(isAwaitingDoctorReply).length;
  const doctorPendingCasesCount = kindFilteredRequests.filter(
    (request) => !isPatientRequestCompleted(request)
  ).length;
  const doctorCompletedCasesCount = kindFilteredRequests.filter(isPatientRequestCompleted).length;
  const doctorAllCasesCount = kindFilteredRequests.length;

  const load = useCallback(
    async (options?: { silent?: boolean; manual?: boolean }) => {
      if (!canLoad) {
        setRequests([]);
        setLoading(false);
        setRefreshing(false);
        hasLoadedOnceRef.current = false;
        return;
      }

      const silent = options?.silent ?? hasLoadedOnceRef.current;
      const manual = options?.manual ?? false;

      if (manual) {
        setRefreshing(true);
      } else if (!silent) {
        setLoading(true);
        setError(null);
      }

      const result =
        view === 'patient'
          ? await fetchPatientOpinionRequests(patientAuthUserId!)
          : await fetchDoctorOpinionRequests();

      if (result.error) {
        if (!silent || manual) {
          setError(result.error.message);
          if (!silent) setRequests([]);
        }
      } else {
        setRequests(result.data ?? []);
        if (!silent || manual) setError(null);
      }

      hasLoadedOnceRef.current = true;
      setLoading(false);
      setRefreshing(false);
    },
    [canLoad, view, patientAuthUserId, doctorId, doctorEmail]
  );

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    void load();
  }, [load]);

  useEffect(() => {
    if (view !== 'doctor' || !canLoad) return;
    return subscribeDoctorOpinionRequestUpdates(() => void load({ silent: true }), { doctorId });
  }, [view, canLoad, doctorId, load]);

  // Catch cases realtime may miss (e.g. row newly assigned to this doctor under RLS).
  useEffect(() => {
    if (view !== 'doctor' || !canLoad || !isElixHealthWorkspace) return;

    const refreshSilently = () => {
      if (document.visibilityState === 'hidden') return;
      void load({ silent: true });
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshSilently();
    };

    window.addEventListener('focus', refreshSilently);
    document.addEventListener('visibilitychange', onVisibility);
    const intervalId = window.setInterval(refreshSilently, DOCTOR_CASES_POLL_MS);

    return () => {
      window.removeEventListener('focus', refreshSilently);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(intervalId);
    };
  }, [view, canLoad, isElixHealthWorkspace, load]);

  const handleRefresh = useCallback(() => {
    void load({ manual: true });
  }, [load]);

  const patchDoctorRequest = useCallback((updated: OpinionRequest) => {
    setRequests((prev) => prev.map((request) => (request.id === updated.id ? updated : request)));
  }, []);

  const showOpenRecordError = useCallback((message: string) => {
    setActionMessage(message);
  }, []);

  return (
    <div
      className={
        isElixHealthWorkspace
          ? 'screen-grid doctors-screen doctor-cases-workspace elixhealth-datatable-page'
          : 'screen-grid doctors-screen'
      }
    >
      <section
        className={
          isElixHealthWorkspace
            ? 'section-card doctor-cases-workspace__card elixhealth-datatable-card'
            : 'section-card'
        }
      >
        <div className='section-head doctor-cases-workspace__head'>
          <div className='doctor-cases-workspace__head-copy'>
            <h3>
              <ClipboardList size={isElixHealthWorkspace ? 18 : 22} className='inline-icon' aria-hidden />{' '}
              {title}
            </h3>
            {!isElixHealthWorkspace ? <p>{subtitle}</p> : null}
          </div>
          {view === 'doctor' && canLoad ? (
            <div className='doctor-cases-workspace__head-actions'>
              {isElixHealthWorkspace ? (
                <>
                  <Select
                    className='doctor-cases-workspace__status-filter'
                    aria-label='Filter cases'
                    data={[
                      { value: 'all', label: `All assigned (${doctorAllCasesCount})` },
                      { value: 'pending', label: `Pending (${doctorPendingCasesCount})` },
                      { value: 'completed', label: `Past (${doctorCompletedCasesCount})` }
                    ]}
                    value={doctorStatusFilter}
                    onChange={(value) =>
                      setDoctorStatusFilter((value as DoctorCaseStatusFilter) ?? 'pending')
                    }
                    allowDeselect={false}
                    radius='md'
                    size='xs'
                    comboboxProps={{ withinPortal: true, zIndex: 460 }}
                  />
                  <TextInput
                  className='doctor-cases-workspace__search'
                  placeholder='Search patients…'
                  value={doctorSearch}
                  onChange={(event) => setDoctorSearch(event.currentTarget.value)}
                  leftSection={<IconSearch size={14} stroke={1.5} aria-hidden />}
                  leftSectionPointerEvents='none'
                  leftSectionWidth={30}
                  radius='md'
                  size='xs'
                  aria-label='Search patient requests'
                />
                </>
              ) : null}
              <Button
                variant='default'
                radius='md'
                size={isElixHealthWorkspace ? 'xs' : 'sm'}
                leftSection={<RefreshCw size={14} className={refreshing ? 'spin' : undefined} />}
                loading={refreshing}
                onClick={handleRefresh}
              >
                Refresh
              </Button>
            </div>
          ) : null}
        </div>

        {!configured ? (
          <p className='auth-error' role='alert'>
            ElixClinix is not configured. Add credentials in <code>.env.local</code> to load requests.
          </p>
        ) : null}

        {!canLoad ? <p className='muted'>{signInHint}</p> : null}

        {loading ? (
          <p className='doctor-status' aria-live='polite'>
            <Loader2 size={18} className='spin' aria-hidden /> Loading requests…
          </p>
        ) : null}

        {error ? (
          <p className='auth-error' role='alert'>
            {error}
            {view === 'doctor' ? (
              <>
                {' '}
                If the list is empty, run <code>006_doctor_opinion_access.sql</code>. If you see a column error, run{' '}
                <code>009_opinion_doctor_response.sql</code>.
              </>
            ) : null}
          </p>
        ) : null}

        {actionMessage ? (
          <p className='auth-error' role='status'>
            {actionMessage}
          </p>
        ) : null}

        {view === 'doctor' &&
        !loading &&
        !error &&
        !isElixHealthWorkspace &&
        doctorConsultationQueue.length > 0 ? (
          <div className='case-review-consultation-banner'>
            <p className='case-review-consultation-banner__text'>
              {doctorPendingCount > 0
                ? `${doctorPendingCount} case${doctorPendingCount === 1 ? '' : 's'} ready for your consultation.`
                : `${doctorConsultationQueue.length} case${doctorConsultationQueue.length === 1 ? '' : 's'} — you can update consultations below.`}
            </p>
            {doctorPendingCount === 1 ? (
              <DoctorGiveConsultationButton
                request={doctorConsultationQueue.find(isAwaitingDoctorReply) ?? doctorConsultationQueue[0]!}
                onNavigate={onNavigate}
                returnScreen={doctorReturnScreen}
              />
            ) : null}
          </div>
        ) : null}

        {!loading && !error && canLoad && view === 'doctor' && isElixHealthWorkspace ? (
          <div className='doctor-cases-cards doctor-cases-workspace__cards-area'>
            <DoctorIncomingRequestsCardList
              data={visibleRequests}
              search={doctorSearch}
              onSearchChange={setDoctorSearch}
              hasActiveFilters={Boolean(doctorSearch.trim())}
              onClearFilters={() => setDoctorSearch('')}
                emptyHint={
                  doctorStatusFilter === 'completed'
                    ? 'No past requests yet.'
                    : doctorStatusFilter === 'pending'
                      ? 'No pending assigned requests.'
                      : emptyHint
                }
              onNavigate={onNavigate}
              returnScreen={doctorReturnScreen}
              onOpenError={showOpenRecordError}
              onRequestUpdated={patchDoctorRequest}
              layout='workspace'
              hideSearch
            />
          </div>
        ) : null}

        {!loading && !error && canLoad && requests.length === 0 && !(view === 'doctor' && isElixHealthWorkspace) ? (
          <p className='muted'>
            {emptyHint}
            {view === 'doctor' && doctorEmail ? (
              <>
                {' '}
                Signed in as <strong>{doctorEmail}</strong> — patients must send a request to this doctor profile.
              </>
            ) : null}
          </p>
        ) : null}

        {!loading && !error && requests.length > 0 && view === 'doctor' && !isElixHealthWorkspace ? (
          <div className='doctor-cases-cards'>
            <DoctorIncomingRequestsCardList
              data={visibleRequests}
              search={doctorSearch}
              onSearchChange={setDoctorSearch}
              hasActiveFilters={Boolean(doctorSearch.trim())}
              onClearFilters={() => setDoctorSearch('')}
              onNavigate={onNavigate}
              returnScreen={doctorReturnScreen}
              onOpenError={showOpenRecordError}
              onRequestUpdated={patchDoctorRequest}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

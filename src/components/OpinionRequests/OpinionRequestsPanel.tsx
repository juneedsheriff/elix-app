import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ClipboardList, Loader2 } from 'lucide-react';
import DoctorGiveConsultationButton from './DoctorGiveConsultationButton';
import DoctorIncomingRequestsTable from './DoctorIncomingRequestsTable';
import DoctorIncomingRequestsMobileList from './DoctorIncomingRequestsMobileList';
import { canDoctorGiveConsultation } from '../../lib/doctorConsultation';
import {
  fetchDoctorOpinionRequests,
  fetchPatientOpinionRequests,
  isAwaitingDoctorReply,
  patientRequestStatusLabel,
  subscribeDoctorOpinionRequestUpdates
} from '../../lib/opinionRequests';
import type { OpinionRequest } from '../../types/opinionRequest';

function statusLabel(status: string, view: 'patient' | 'doctor', request?: OpinionRequest): string {
  if (view === 'patient' && request) {
    return patientRequestStatusLabel(request);
  }
  if (status === 'in_review') return 'In review';
  if (status === 'closed') return 'Closed';
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
  doctorReturnScreen = 'case-review'
}: OpinionRequestsPanelProps) {
  const location = useLocation();
  const isElixHealthWorkspace =
    view === 'doctor' && location.pathname.startsWith('/elixhealth/workspace');

  const [requests, setRequests] = useState<OpinionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [doctorSearch, setDoctorSearch] = useState('');
  const hasLoadedOnceRef = useRef(false);

  const canLoad = view === 'patient' ? Boolean(patientAuthUserId) : Boolean(doctorId || doctorEmail);

  const visibleRequests = useMemo(() => {
    if (view !== 'doctor' || !doctorSearch.trim()) return requests;
    return requests.filter((request) => matchesDoctorSearch(request, doctorSearch));
  }, [doctorSearch, requests, view]);

  const doctorConsultationQueue =
    view === 'doctor' ? requests.filter(canDoctorGiveConsultation) : [];
  const doctorPendingCount = doctorConsultationQueue.filter(isAwaitingDoctorReply).length;

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

      const result =
        view === 'patient'
          ? await fetchPatientOpinionRequests(patientAuthUserId!)
          : await fetchDoctorOpinionRequests();

      if (result.error) {
        if (!silent) {
          setError(result.error.message);
          setRequests([]);
        }
      } else {
        setRequests(result.data ?? []);
        if (!silent) setError(null);
      }

      hasLoadedOnceRef.current = true;
      setLoading(false);
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
      <section className={isElixHealthWorkspace ? 'section-card doctor-cases-workspace__card' : 'section-card'}>
        <div className='section-head'>
          <h3>
            <ClipboardList size={22} className='inline-icon' aria-hidden /> {title}
          </h3>
          <p>{subtitle}</p>
        </div>

        {!configured ? (
          <p className='auth-error' role='alert'>
            Connect Supabase in <code>.env.local</code> to load requests.
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

        {view === 'doctor' && !loading && !error && doctorConsultationQueue.length > 0 ? (
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

        {!loading && !error && canLoad && requests.length === 0 ? (
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

        {!loading && !error && requests.length > 0 ? (
          <>
            {view === 'doctor' ? (
              <>
                <div className='doctor-cases-desktop'>
                  <div className='elixhealth-datatable-card doctors-mgmt-table-card'>
                    <DoctorIncomingRequestsTable
                      data={visibleRequests}
                      isLoading={loading}
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
                </div>
                <div className='doctor-cases-mobile'>
                  <DoctorIncomingRequestsMobileList
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
              </>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}

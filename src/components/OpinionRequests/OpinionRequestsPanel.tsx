import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, FileText, Loader2, Stethoscope } from 'lucide-react';
import ConsultationPatientWorkflow from './ConsultationPatientWorkflow';
import { canDoctorGiveConsultation } from '../../lib/doctorConsultation';
import DoctorGiveConsultationButton from './DoctorGiveConsultationButton';
import DoctorRequestRespond from './DoctorRequestRespond';
import { fetchDoctorOpinionRequests, fetchPatientOpinionRequests, isAwaitingDoctorReply, patientRequestStatusLabel } from '../../lib/opinionRequests';
import { getMedicalRecordDownloadUrl } from '../../lib/records';
import type { OpinionRequest } from '../../types/opinionRequest';

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
  return date.toLocaleString();
}

function statusLabel(status: string, view: 'patient' | 'doctor', request?: OpinionRequest): string {
  if (view === 'patient' && request) {
    return patientRequestStatusLabel(request);
  }
  if (status === 'in_review') return 'In review';
  if (status === 'closed') return 'Closed';
  return 'Submitted';
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
  const [requests, setRequests] = useState<OpinionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canLoad = view === 'patient' ? Boolean(patientAuthUserId) : Boolean(doctorId || doctorEmail);

  const doctorConsultationQueue =
    view === 'doctor' ? requests.filter(canDoctorGiveConsultation) : [];
  const doctorPendingCount = doctorConsultationQueue.filter(isAwaitingDoctorReply).length;

  const load = useCallback(async () => {
    if (!canLoad) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const result =
      view === 'patient'
        ? await fetchPatientOpinionRequests(patientAuthUserId!)
        : await fetchDoctorOpinionRequests();

    if (result.error) {
      setError(result.error.message);
      setRequests([]);
    } else {
      setRequests(result.data ?? []);
    }
    setLoading(false);
  }, [canLoad, view, patientAuthUserId, doctorId, doctorEmail]);

  useEffect(() => {
    void load();
  }, [load]);

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

  return (
    <div className='screen-grid doctors-screen'>
      <section className='section-card'>
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

        {successMessage ? (
          <p className='muted' role='status'>
            {successMessage}
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
          <ul className='list doctor-request-list'>
            {requests.map((request) => (
              <li key={request.id} className='doctor-request-card'>
                <div className='doctor-request-head'>
                  <strong>
                    {view === 'patient'
                      ? request.doctor_name ?? 'Doctor'
                      : request.patient_name ?? 'Patient'}
                  </strong>
                  <span className={`tag status-${request.status}`}>{statusLabel(request.status, view, request)}</span>
                </div>
                <p className='doctor-request-names'>
                  <span>
                    <strong>Patient:</strong> {request.patient_name ?? '—'}
                  </span>
                  <span>
                    <strong>Doctor:</strong> {request.doctor_name ?? '—'}
                    {request.doctor_specialty ? ` (${request.doctor_specialty})` : ''}
                  </span>
                </p>
                <p className='doctor-request-meta'>
                  {view === 'doctor' && request.patient_email ? `${request.patient_email} • ` : ''}
                  {formatRequestDate(request.created_at)}
                  {request.records.length
                    ? ` • ${request.records.length} file${request.records.length === 1 ? '' : 's'}`
                    : ''}
                </p>
                <p className='doctor-request-message'>
                  <strong>{view === 'doctor' ? 'Patient message:' : 'Your message:'}</strong> {request.message}
                </p>

                {view === 'patient' && request.doctor_response ? (
                  <div className='doctor-response-block patient-view' role='region' aria-label='Doctor response'>
                    <h5>
                      <Stethoscope size={16} aria-hidden /> Doctor&apos;s opinion
                    </h5>
                    <p>{request.doctor_response}</p>
                    {request.responded_at ? (
                      <span className='muted'>Received {formatRequestDate(request.responded_at)}</span>
                    ) : null}
                  </div>
                ) : null}

                {view === 'patient' ? (
                  <ConsultationPatientWorkflow
                    request={request}
                    onUpdated={() => void load()}
                    onOpenRecord={(path) => void openRecord(path)}
                    onMessage={(message, type) => {
                      if (type === 'error') {
                        setActionMessage(message);
                        setSuccessMessage(null);
                      } else {
                        setSuccessMessage(message);
                        setActionMessage(null);
                      }
                    }}
                  />
                ) : null}

                {view === 'patient' &&
                !request.consultation_stage &&
                !request.doctor_response &&
                request.status !== 'closed' ? (
                  <p className='muted doctor-awaiting-response'>
                    {!request.assigned_to && request.status === 'submitted'
                      ? 'Waiting for admin review before coordination begins.'
                      : 'Our patient service team is coordinating your request.'}
                  </p>
                ) : null}

                {view === 'doctor' && (request.scheduled_at || request.meeting_link) ? (
                  <div className='doctor-response-block' role='region' aria-label='Appointment details'>
                    <h5>Appointment</h5>
                    {request.scheduled_at ? (
                      <p className='muted'>{new Date(request.scheduled_at).toLocaleString()}</p>
                    ) : null}
                    {request.meeting_link ? (
                      <p>
                        <a href={request.meeting_link} target='_blank' rel='noreferrer'>
                          Join meeting
                        </a>
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {request.records.length > 0 ? (
                  <ul className='record-select-list doctor-request-files'>
                    {request.records.map((record) => (
                      <li key={record.id}>
                        <div className='record-select-item doctor-request-file-row'>
                          <FileText size={18} aria-hidden />
                          <span className='record-select-text'>
                            <strong>{record.file_name}</strong>
                            {record.summary ? <span className='muted'>{record.summary}</span> : null}
                          </span>
                          {record.storage_path ? (
                            <button
                              type='button'
                              className='text-btn'
                              onClick={() => void openRecord(record.storage_path)}
                            >
                              Open
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {view === 'doctor' && canDoctorGiveConsultation(request) ? (
                  <DoctorRequestRespond
                    request={request}
                    onNavigate={onNavigate}
                    returnScreen={doctorReturnScreen}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

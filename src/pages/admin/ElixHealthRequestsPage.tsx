import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, FileText, Loader2, Send } from 'lucide-react';
import SectionCard from '../../components/ui/SectionCard';
import { fetchPatientServiceExecutives } from '../../lib/admins';
import {
  assignOpinionRequest,
  fetchOpinionRequestsForStaff,
  forwardOpinionRequestToDoctor,
  isAssignedToPatientService,
  isPendingAdminAssignment,
  staffRequestStatusLabel
} from '../../lib/opinionRequests';
import { getMedicalRecordDownloadUrl } from '../../lib/records';
import { isAdministrator, isPatientServiceExecutive } from '../../lib/staffPermissions';
import type { Admin } from '../../types/admin';
import type { OpinionRequest } from '../../types/opinionRequest';
import { useElixHealthStaff } from './ElixHealthStaffContext';

type RequestFilter = 'pending' | 'all';

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

function cell(value: string | null | undefined) {
  const v = value?.trim();
  return v ? v : '—';
}

export default function ElixHealthRequestsPage() {
  const staff = useElixHealthStaff();
  const isAdmin = isAdministrator(staff);
  const isPse = isPatientServiceExecutive(staff);

  const [requests, setRequests] = useState<OpinionRequest[]>([]);
  const [executives, setExecutives] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RequestFilter>('pending');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assigneeByRequest, setAssigneeByRequest] = useState<Record<string, string>>({});
  const [notesByRequest, setNotesByRequest] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [requestsRes, executivesRes] = await Promise.all([
      fetchOpinionRequestsForStaff(),
      isAdmin ? fetchPatientServiceExecutives() : Promise.resolve({ data: [] as Admin[], error: null })
    ]);

    if (requestsRes.error) {
      setError(requestsRes.error.message);
      setRequests([]);
    } else {
      setRequests(requestsRes.data ?? []);
    }

    if (executivesRes.error && isAdmin) {
      setError(executivesRes.error.message);
    } else if (isAdmin) {
      setExecutives(executivesRes.data ?? []);
    }

    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = useMemo(() => {
    if (isAdmin) {
      return requests.filter(isPendingAdminAssignment).length;
    }
    return requests.filter(isAssignedToPatientService).length;
  }, [isAdmin, requests]);

  const visibleRequests = useMemo(() => {
    if (filter === 'pending') {
      if (isAdmin) return requests.filter(isPendingAdminAssignment);
      return requests.filter(isAssignedToPatientService);
    }
    return requests;
  }, [filter, isAdmin, requests]);

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

  const handleAssign = async (request: OpinionRequest) => {
    const assigneeId = assigneeByRequest[request.id];
    if (!assigneeId) {
      setActionMessage('Select a Patient Service Executive before assigning.');
      return;
    }

    setBusyId(request.id);
    setActionMessage(null);
    setSuccessMessage(null);

    const { error: assignError } = await assignOpinionRequest(request.id, assigneeId);
    setBusyId(null);

    if (assignError) {
      setActionMessage(assignError.message);
      return;
    }

    const executive = executives.find((e) => e.id === assigneeId);
    setSuccessMessage(
      `Assigned request from ${request.patient_name ?? 'patient'} to ${executive?.full_name ?? 'Patient Service Executive'}.`
    );
    void load();
  };

  const handleForward = async (request: OpinionRequest) => {
    setBusyId(request.id);
    setActionMessage(null);
    setSuccessMessage(null);

    const { error: forwardError } = await forwardOpinionRequestToDoctor(
      request.id,
      notesByRequest[request.id]
    );
    setBusyId(null);

    if (forwardError) {
      setActionMessage(forwardError.message);
      return;
    }

    setSuccessMessage(`Sent request to ${request.doctor_name ?? 'doctor'} for review.`);
    void load();
  };

  if (loading) {
    return (
      <p className='elixhealth-status'>
        <Loader2 size={18} className='spin' aria-hidden /> Loading opinion requests…
      </p>
    );
  }

  if (error) {
    return (
      <p className='auth-error' role='alert'>
        {error}. Ensure migration 017_staff_roles_request_assignment.sql is applied in Supabase.
      </p>
    );
  }

  return (
    <div className='elixhealth-requests'>
      <SectionCard
        title={isPse ? 'My assigned requests' : 'Opinion requests'}
        subtitle={
          isAdmin
            ? `${pendingCount} pending assignment • ${requests.length} total`
            : `${pendingCount} awaiting coordination • ${requests.length} assigned to you`
        }
      >
        <div className='elixhealth-requests-toolbar'>
          <div className='elixhealth-profile-tabs' role='tablist' aria-label='Request filters'>
            <button
              type='button'
              role='tab'
              aria-selected={filter === 'pending'}
              className={
                filter === 'pending'
                  ? 'elixhealth-profile-tab elixhealth-profile-tab--active'
                  : 'elixhealth-profile-tab'
              }
              onClick={() => setFilter('pending')}
            >
              Pending ({pendingCount})
            </button>
            <button
              type='button'
              role='tab'
              aria-selected={filter === 'all'}
              className={
                filter === 'all'
                  ? 'elixhealth-profile-tab elixhealth-profile-tab--active'
                  : 'elixhealth-profile-tab'
              }
              onClick={() => setFilter('all')}
            >
              All ({requests.length})
            </button>
          </div>
          <button type='button' className='elixhealth-retry-link' onClick={() => void load()}>
            Refresh
          </button>
        </div>

        {actionMessage ? (
          <p className='auth-error' role='alert'>
            {actionMessage}
          </p>
        ) : null}

        {successMessage ? (
          <p className='elixhealth-success' role='status'>
            {successMessage}
          </p>
        ) : null}

        {visibleRequests.length === 0 ? (
          <p className='muted'>
            {filter === 'pending'
              ? isAdmin
                ? 'No requests waiting for assignment.'
                : 'No assigned requests waiting for coordination.'
              : 'No opinion requests yet.'}
          </p>
        ) : (
          <div className='elixhealth-table-wrap elixhealth-table-wrap--scroll'>
            <table className='elixhealth-table elixhealth-table--compact elixhealth-table--sticky-edges'>
              <thead>
                <tr>
                  <th className='elixhealth-table__col-sticky-start elixhealth-table__col-name'>Patient</th>
                  <th>Doctor</th>
                  <th>Submitted</th>
                  <th>Records</th>
                  <th>Status</th>
                  {isAdmin ? <th>Assigned to</th> : null}
                  <th className='elixhealth-table__col-sticky-end'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRequests.map((request) => {
                  const isExpanded = expandedId === request.id;
                  const canAssign = isAdmin && isPendingAdminAssignment(request);
                  const canForward = isPse && isAssignedToPatientService(request);

                  return (
                    <Fragment key={request.id}>
                      <tr key={request.id}>
                        <td className='elixhealth-table__col-sticky-start elixhealth-table__col-name'>
                          <strong>{cell(request.patient_name)}</strong>
                          {request.patient_email ? (
                            <span className='elixhealth-table-subtext'>{request.patient_email}</span>
                          ) : null}
                        </td>
                        <td>
                          {cell(request.doctor_name)}
                          {request.doctor_specialty ? (
                            <span className='elixhealth-table-subtext'>{request.doctor_specialty}</span>
                          ) : null}
                        </td>
                        <td>{formatRequestDate(request.created_at)}</td>
                        <td>{request.records.length}</td>
                        <td>
                          <span className={`tag status-${request.status}`}>
                            {staffRequestStatusLabel(request)}
                          </span>
                        </td>
                        {isAdmin ? <td>{cell(request.assigned_to_name)}</td> : null}
                        <td className='elixhealth-table__col-sticky-end'>
                          <div className='elixhealth-table-actions'>
                            <button
                              type='button'
                              className='elixhealth-row-action'
                              onClick={() => setExpandedId(isExpanded ? null : request.id)}
                            >
                              <Eye size={14} aria-hidden />
                              {isExpanded ? 'Hide' : 'View'}
                            </button>

                            {canAssign ? (
                              <>
                                <select
                                  className='elixhealth-inline-select'
                                  value={assigneeByRequest[request.id] ?? ''}
                                  onChange={(e) =>
                                    setAssigneeByRequest((prev) => ({
                                      ...prev,
                                      [request.id]: e.target.value
                                    }))
                                  }
                                  aria-label={`Assign request from ${request.patient_name ?? 'patient'}`}
                                >
                                  <option value=''>Select PSE…</option>
                                  {executives.map((executive) => (
                                    <option key={executive.id} value={executive.id}>
                                      {executive.full_name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type='button'
                                  className='primary-btn elixhealth-table-action-btn'
                                  disabled={busyId === request.id || executives.length === 0}
                                  onClick={() => void handleAssign(request)}
                                >
                                  {busyId === request.id ? (
                                    <Loader2 size={14} className='spin' aria-hidden />
                                  ) : (
                                    'Assign'
                                  )}
                                </button>
                              </>
                            ) : null}

                            {canForward ? (
                              <button
                                type='button'
                                className='primary-btn elixhealth-table-action-btn'
                                disabled={busyId === request.id}
                                onClick={() => void handleForward(request)}
                              >
                                {busyId === request.id ? (
                                  <Loader2 size={14} className='spin' aria-hidden />
                                ) : (
                                  <>
                                    <Send size={14} aria-hidden /> Send to doctor
                                  </>
                                )}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr key={`${request.id}-detail`} className='elixhealth-table-detail-row'>
                          <td colSpan={isAdmin ? 7 : 6}>
                            <div className='elixhealth-request-detail'>
                              <p>
                                <strong>Patient message:</strong> {request.message}
                              </p>
                              {request.coordination_notes ? (
                                <p>
                                  <strong>Coordination notes:</strong> {request.coordination_notes}
                                </p>
                              ) : null}
                              {canForward ? (
                                <label className='elixhealth-field elixhealth-field--full'>
                                  <span>Coordination notes (optional)</span>
                                  <textarea
                                    rows={2}
                                    value={notesByRequest[request.id] ?? ''}
                                    onChange={(e) =>
                                      setNotesByRequest((prev) => ({
                                        ...prev,
                                        [request.id]: e.target.value
                                      }))
                                    }
                                    placeholder='Notes for the doctor about patient coordination…'
                                  />
                                </label>
                              ) : null}
                              {request.records.length > 0 ? (
                                <ul className='record-select-list doctor-request-files'>
                                  {request.records.map((record) => (
                                    <li key={record.id}>
                                      <div className='record-select-item doctor-request-file-row'>
                                        <FileText size={18} aria-hidden />
                                        <span className='record-select-text'>
                                          <strong>{record.file_name}</strong>
                                          {record.summary ? (
                                            <span className='muted'>{record.summary}</span>
                                          ) : null}
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
                              ) : (
                                <p className='muted'>No medical records attached.</p>
                              )}
                              {request.doctor_response ? (
                                <div className='doctor-response-block patient-view'>
                                  <h5>Doctor&apos;s opinion</h5>
                                  <p>{request.doctor_response}</p>
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {isAdmin && executives.length === 0 ? (
          <p className='muted'>
            Add a staff account with role <strong>Patient Service Executive</strong> to assign requests.
          </p>
        ) : null}
      </SectionCard>
    </div>
  );
}

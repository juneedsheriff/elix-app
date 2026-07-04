import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Drawer,
  Select,
  Text,
  ThemeIcon
} from '@mantine/core';

import {

  IconAlertCircle,

  IconArrowLeft,
  IconArrowRight,

  IconCalendar,

  IconClock,

  IconMail,
  IconMessage2,

  IconUser,

  IconUserCheck

} from '@tabler/icons-react';

import { hasPseCoordinationStarted, isPendingAdminAssignment, staffRequestStatusLabel } from '../../../lib/opinionRequests';
import OpinionRequestActivityPage from '../../../components/OpinionRequests/OpinionRequestActivityPage';
import OpinionRequestAuditLink from '../../../components/OpinionRequests/OpinionRequestAuditLink';
import RequestChatPanel from '../../../components/OpinionRequests/RequestChatPanel';

import type { Admin } from '../../../types/admin';

import type { Doctor } from '../../../types/doctor';

import type { OpinionRequest } from '../../../types/opinionRequest';

import { useElixHealthStaff } from '../ElixHealthStaffContext';

import RequestWorkflowWizard from './RequestWorkflowWizard';

import { formatRequestDate, requestStatusColor } from './requestsUtils';

import { isAdministrator, isAnyPatientServiceExecutive, isClinicPatientServiceExecutive } from '../../../lib/staffPermissions';



type RequestDetailDrawerProps = {

  request: OpinionRequest | null;

  opened: boolean;

  onClose: () => void;

  isAdmin: boolean;

  isPse: boolean;

  executives: Admin[];

  doctors: Doctor[];

  assigneeId: string;

  onAssigneeChange: (value: string) => void;

  busy: boolean;

  onAssign: () => void;

  onOpenRecord: (storagePath: string) => void;

  onWorkflowUpdated: () => void;

  onRequestPatch?: (patch: Partial<OpinionRequest> & { id: string }) => void;

  onError: (message: string) => void;

  onSuccess: (message: string) => void;

  coordinationUnlocked?: boolean;

  feedbackMessage?: string | null;

  feedbackSuccess?: string | null;

};



export default function RequestDetailDrawer({

  request,

  opened,

  onClose,

  isAdmin,

  executives,

  doctors,

  assigneeId,

  onAssigneeChange,

  busy,

  onAssign,

  onOpenRecord,

  onWorkflowUpdated,

  onRequestPatch,

  onError,

  onSuccess,

  coordinationUnlocked = false,

  feedbackMessage,

  feedbackSuccess

}: RequestDetailDrawerProps) {

  const [showActivity, setShowActivity] = useState(false);
  const [showRequestChatPanel, setShowRequestChatPanel] = useState(false);

  useEffect(() => {
    setShowActivity(false);
    setShowRequestChatPanel(false);
  }, [request?.id, opened]);

  const { staff } = useElixHealthStaff();

  const staffIsPse = isAnyPatientServiceExecutive(staff);
  const staffIsClinicPse = isClinicPatientServiceExecutive(staff);
  const staffIsAdmin = isAdministrator(staff);



  if (!request) return null;



  const isClosed = request.status === 'closed';
  const isClinicRequest = Boolean(request.clinic_id);
  const pseCoordinationStarted =
    hasPseCoordinationStarted(request) || (isAdmin && coordinationUnlocked);
  const adminViewer = isAdmin && !staffIsPse;

  const isAssignedToMe = Boolean(
    request.assigned_to &&
      (request.assigned_to === staff.id ||
        (staff.auth_user_id && request.assigned_to === staff.auth_user_id))
  );

  const canAssign = isAdmin && isPendingAdminAssignment(request);

  const showAssignSection = canAssign && !isClosed && !isClinicRequest;

  // Clinic PSE can open unassigned clinic-queue rows (RLS). Do not gate on clinic_id in the
  // client model — it can be missing from older selects even when the row is clinic-scoped.
  const isClinicClaimPending =
    staffIsClinicPse &&
    !isClosed &&
    !request.assigned_to &&
    !hasPseCoordinationStarted(request);

  const assignedExecutiveName =

    request.assigned_to_name ??

    executives.find((executive) => executive.id === request.assigned_to)?.full_name ??

    (isAssignedToMe ? staff.full_name : null) ??

    null;

  const executiveSelectData = (() => {
    const options = executives.map((executive) => ({
      value: executive.id,
      label: executive.full_name
    }));
    if (
      request.assigned_to &&
      !options.some((option) => option.value === request.assigned_to)
    ) {
      options.unshift({
        value: request.assigned_to,
        label: assignedExecutiveName ?? 'Assigned executive'
      });
    }
    return options;
  })();

  const assignSelectValue = assigneeId || request.assigned_to || null;

  // Some environments may miss assigned_to in the payload while consultation_stage is already
  // advanced; in that case still unlock workflow for the PSE queue row.
  // RLS still enforces write permissions server-side.
  const canCoordinate =
    staffIsPse &&
    !isClosed &&
    (Boolean(request.assigned_to) || hasPseCoordinationStarted(request));

  const canViewClosedWorkflow =
    isClosed &&
    (staffIsAdmin ||
      (staffIsPse &&
        (Boolean(request.assigned_to) || hasPseCoordinationStarted(request))));

  const adminWorkflowView =
    adminViewer && !isClosed && (isClinicRequest || pseCoordinationStarted);

  const needsAssignmentForAdmin =
    adminViewer && !isClinicRequest && !pseCoordinationStarted && !isClosed;

  const adminViewingAssigned =
    adminViewer && !isClinicRequest && pseCoordinationStarted && !isClosed;

  const showWorkflowWizard = canCoordinate || adminWorkflowView || canViewClosedWorkflow;
  const showRequestChat = staffIsPse && (showWorkflowWizard || hasPseCoordinationStarted(request));
  const drawerChatMode = showRequestChat && showRequestChatPanel;

  const showCoordinationEmpty =
    !showActivity &&
    !feedbackMessage &&
    !feedbackSuccess &&
    !needsAssignmentForAdmin &&
    !adminViewingAssigned &&
    !isClinicClaimPending &&
    !showAssignSection &&
    !showWorkflowWizard;

  const statusColor = requestStatusColor(request);

  return (

    <Drawer

      opened={opened}

      onClose={onClose}

      title={`Request coordination - ${request.patient_name ?? 'Patient'}`}

      position='right'

      size='60%'

      radius='md'

      padding={0}

      classNames={{

        content: 'doctors-mgmt-drawer request-detail-drawer',

        header: 'request-detail-drawer__mantine-header',

        title: 'request-detail-drawer__mantine-title',

        body: `doctors-mgmt-drawer__body request-detail-drawer__body${
          drawerChatMode ? ' request-detail-drawer__body--chat' : ''
        }`,

        close: 'request-detail-drawer__close'

      }}

    >

      <div
        className={`request-detail-drawer__shell${
          drawerChatMode ? ' request-detail-drawer__shell--chat' : ''
        }`}
      >

        <header className='request-detail-drawer__hero'>

          <div className='request-detail-drawer__hero-accent' aria-hidden />

          <div className='request-detail-drawer__hero-inner'>

            <div className='request-detail-drawer__patient'>
 

              <div className='request-detail-drawer__patient-meta'>
                <ul className='request-detail-drawer__facts'>
                  {request.patient_email ? (
                    <li className='request-detail-drawer__fact'>
                      <span className='request-detail-drawer__fact-icon' aria-hidden>
                        <IconMail size={12} stroke={1.75} />
                      </span>
                      <span className='request-detail-drawer__fact-text'>
                        <span className='request-detail-drawer__fact-label'>Email</span>
                        {request.patient_email}
                      </span>
                    </li>
                  ) : null}
                  <li className='request-detail-drawer__fact'>
                    <span className='request-detail-drawer__fact-icon' aria-hidden>
                      <IconClock size={12} stroke={1.75} />
                    </span>
                    <span className='request-detail-drawer__fact-text'>
                      <span className='request-detail-drawer__fact-label'>Submitted</span>
                      {formatRequestDate(request.created_at)}
                    </span>
                  </li>
                  {request.doctor_name ? (
                    <li className='request-detail-drawer__fact'>
                      <span className='request-detail-drawer__fact-icon' aria-hidden>
                        <IconUser size={12} stroke={1.75} />
                      </span>
                      <span className='request-detail-drawer__fact-text'>
                        <span className='request-detail-drawer__fact-label'>Initial doctor</span>
                        {request.doctor_name}
                        {request.doctor_specialty ? ` · ${request.doctor_specialty}` : ''}
                      </span>
                    </li>
                  ) : null}
                </ul>
              </div>

            </div>

            <Badge
              variant='light'
              color={statusColor}
              radius='xl'
              size='sm'
              className={`request-detail-drawer__status doctors-mgmt-status request-detail-drawer__status--${statusColor}`}
            >

              {staffRequestStatusLabel(request)}

            </Badge>

            <OpinionRequestAuditLink
              buttonClassName='request-detail-drawer__audit-btn'
              buttonLabel='Activity history'
              onOpen={() => setShowActivity(true)}
            />

          </div>

          {isClosed ? (

            <div className='request-detail-drawer__closed-banner' role='status'>

              <IconCalendar size={16} stroke={1.75} aria-hidden />

              <Text size='sm'>This request is closed. Coordination steps are read-only.</Text>

            </div>

          ) : adminViewer && pseCoordinationStarted ? (

            <div className='request-detail-drawer__closed-banner' role='status'>

              <IconUserCheck size={16} stroke={1.75} aria-hidden />

              <Text size='sm'>
                Assigned to {assignedExecutiveName ?? 'a Patient Service Executive'}. Coordination
                steps are read-only for administrators.
              </Text>

            </div>

          ) : null}

        </header>



        <div
          className={`request-detail-drawer__content${
            drawerChatMode ? ' request-detail-drawer__content--chat' : ''
          }`}
        >

          {showActivity ? (
            <OpinionRequestActivityPage
              variant='staff'
              requestId={request.id}
              requestLabel={request.patient_name ?? 'Patient request'}
              backLabel='Back to coordination'
              subtitle='Actions by patient, PSE, doctor, and admin on this request.'
              onBack={() => setShowActivity(false)}
            />
          ) : (
            <>
          {feedbackMessage ? (
            <Alert color='red' radius='md' mb='md'>
              {feedbackMessage}
            </Alert>
          ) : null}
          {feedbackSuccess ? (
            <Alert color='green' radius='md' mb='md'>
              {feedbackSuccess}
            </Alert>
          ) : null}
          {needsAssignmentForAdmin ? (

            <section className='request-detail-drawer__notice request-detail-drawer__notice--warn'>

              <ThemeIcon

                size={36}

                radius='md'

                variant='light'

                color='orange'

                className='request-detail-drawer__notice-icon'

              >

                <IconAlertCircle size={20} stroke={1.75} />

              </ThemeIcon>

              <div className='request-detail-drawer__notice-copy'>

                <Text fw={600} size='sm'>

                  Assign before coordinating

                </Text>

                <Text size='sm' c='dimmed'>

                  Assign this request to a Patient Service Executive to start the coordination

                  wizard.

                </Text>

              </div>

            </section>

          ) : null}



          {adminViewingAssigned ? (

            <section className='request-detail-drawer__notice request-detail-drawer__notice--success'>

              <ThemeIcon

                size={36}

                radius='md'

                variant='light'

                color='teal'

                className='request-detail-drawer__notice-icon'

              >

                <IconUserCheck size={20} stroke={1.75} />

              </ThemeIcon>

              <div className='request-detail-drawer__notice-copy'>

                <Text fw={600} size='sm'>

                  Assigned to Patient Service Executive

                </Text>

                <Text size='sm' c='dimmed'>

                  {assignedExecutiveName ? (

                    <>

                      This request is assigned to <strong>{assignedExecutiveName}</strong>

                      {request.assigned_at

                        ? ` on ${new Date(request.assigned_at).toLocaleString()}`

                        : ''}

                      . They will verify records and coordinate the consultation in their queue.

                    </>

                  ) : (

                    <>

                      This request is assigned to a Patient Service Executive. They will handle

                      coordination in their queue.

                    </>

                  )}

                </Text>

              </div>

            </section>

          ) : null}



          {isClinicClaimPending && busy ? (
            <section className='request-detail-drawer__notice request-detail-drawer__notice--success'>
              <ThemeIcon
                size={36}
                radius='md'
                variant='light'
                color='teal'
                className='request-detail-drawer__notice-icon'
              >
                <IconUserCheck size={20} stroke={1.75} />
              </ThemeIcon>
              <div className='request-detail-drawer__notice-copy'>
                <Text fw={600} size='sm'>
                  Assigning to you
                </Text>
                <Text size='sm' c='dimmed'>
                  Opening the coordination steps for this request…
                </Text>
              </div>
            </section>
          ) : null}

          {isClinicClaimPending && !busy ? (
            <section className='request-detail-drawer__assign-card'>
              <div className='request-detail-drawer__assign-head'>
                <ThemeIcon size={40} radius='md' variant='light' color='cyan'>
                  <IconUserCheck size={22} stroke={1.75} />
                </ThemeIcon>
                <div>
                  <Text fw={600} size='sm'>
                    Start coordination
                  </Text>
                  <Text size='xs' c='dimmed'>
                    Claim this request to begin the coordination workflow.
                  </Text>
                </div>
              </div>

              <Button
                radius='md'
                size='md'
                fullWidth
                className='doctors-mgmt-header__primary request-detail-drawer__assign-btn'
                disabled={busy || !assigneeId}
                loading={busy}
                onClick={onAssign}
                rightSection={<IconArrowRight size={18} stroke={1.75} />}
              >
                Assign to me
              </Button>
            </section>
          ) : null}

          {showAssignSection ? (

            <section className='request-detail-drawer__assign-card'>

              <div className='request-detail-drawer__assign-head'>

                <ThemeIcon size={40} radius='md' variant='light' color='cyan'>

                  <IconUserCheck size={22} stroke={1.75} />

                </ThemeIcon>

                <div>

                  <Text fw={600} size='sm'>

                    Assign to Patient Service Executive

                  </Text>

                  <Text size='xs' c='dimmed'>

                    {request.assigned_to

                      ? 'Assigned executive for this request.'

                      : 'Hand off coordination to your team member.'}

                  </Text>

                </div>

              </div>

              <Select
                placeholder='Select executive…'
                data={executiveSelectData}
                value={assignSelectValue}
                onChange={(value) => onAssigneeChange(value ?? '')}
                searchable
                clearable={false}
                allowDeselect={false}
                radius='md'
                size='md'
                disabled={Boolean(request.assigned_to) || busy}
                classNames={{ input: 'request-detail-drawer__select-input' }}
              />

              {canAssign ? (

                <Button

                  radius='md'

                  size='md'

                  fullWidth

                  className='doctors-mgmt-header__primary request-detail-drawer__assign-btn'

                  disabled={busy || !assignSelectValue || executives.length === 0}

                  loading={busy}

                  onClick={onAssign}

                  rightSection={<IconArrowRight size={18} stroke={1.75} />}

                >

                  Assign request

                </Button>

              ) : null}

            </section>

          ) : null}



          {showWorkflowWizard && !showRequestChatPanel ? (

            <section className='request-detail-drawer__workflow'>

             

              <RequestWorkflowWizard

                key={request.id}

                request={request}

                doctors={doctors}

                canCoordinate={canCoordinate}

                onOpenRecord={onOpenRecord}

                onUpdated={onWorkflowUpdated}

                onRequestPatch={onRequestPatch}

                onError={onError}

                onSuccess={onSuccess}

              />

            </section>

          ) : null}

          {showRequestChat && !showRequestChatPanel ? (
            <section className='request-detail-drawer__workflow'>
              <Button
                variant='light'
                color='cyan'
                radius='md'
                onClick={() => setShowRequestChatPanel(true)}
                leftSection={<IconMessage2 size={16} stroke={1.75} />}
              >
                Chat with patient
              </Button>
            </section>
          ) : null}

          {showRequestChat && showRequestChatPanel ? (
            <section className='request-detail-drawer__workflow request-detail-drawer__workflow--chat '>
          <div>
          <Button
                variant='subtle'
                color='gray'
                radius='md'
                onClick={() => setShowRequestChatPanel(false)}
                leftSection={<IconArrowLeft size={16} stroke={1.75} />}
              >
                Back to coordination
              </Button>
          </div>
              <RequestChatPanel
                request={request}
                viewerRole='pse'
                senderStaffId={staff.id}
                disabled={isClosed || !canCoordinate}
                disabledReason={
                  isClosed
                    ? 'This request is closed. Chat is read-only.'
                    : !canCoordinate
                      ? 'Assign or claim this request to send chat messages.'
                      : null
                }
                onError={onError}
              />
            </section>
          ) : null}

          {showCoordinationEmpty ? (
            <section className='request-detail-drawer__notice'>
              <div className='request-detail-drawer__notice-copy'>
                <Text fw={600} size='sm'>
                  Coordination unavailable
                </Text>
                <Text size='sm' c='dimmed'>
                  {staffIsClinicPse && request.assigned_to && !isAssignedToMe
                    ? 'This request is assigned to another coordinator in your clinic.'
                    : staffIsPse && !isAssignedToMe
                      ? 'This request is not assigned to you yet. Refresh the page if you just claimed it.'
                      : 'Refresh the page to load coordination steps.'}
                </Text>
              </div>
            </section>
          ) : null}

            </>
          )}

        </div>

      </div>

    </Drawer>

  );

}



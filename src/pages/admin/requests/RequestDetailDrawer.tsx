import {
  Badge,
  Button,
  Drawer,
  Select,
  Text,
  ThemeIcon
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowRight,
  IconCalendar,
  IconCheck,
  IconClock,
  IconMail,
  IconUser,
  IconUserCheck
} from '@tabler/icons-react';
import { isPendingAdminAssignment, staffRequestStatusLabel } from '../../../lib/opinionRequests';
import type { Admin } from '../../../types/admin';
import type { Doctor } from '../../../types/doctor';
import type { OpinionRequest } from '../../../types/opinionRequest';
import { useElixHealthStaff } from '../ElixHealthStaffContext';
import RequestWorkflowWizard from './RequestWorkflowWizard';
import { formatRequestDate, patientInitials, requestStatusColor } from './requestsUtils';
import { isAdministrator, isPatientServiceExecutive } from '../../../lib/staffPermissions';

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
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
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
  onError,
  onSuccess
}: RequestDetailDrawerProps) {
  const staff = useElixHealthStaff();
  const staffIsPse = isPatientServiceExecutive(staff);
  const staffIsAdmin = isAdministrator(staff);

  if (!request) return null;

  const isAssigned = Boolean(request.assigned_to);
  const canAssign = isAdmin && isPendingAdminAssignment(request);
  const isClosed = request.status === 'closed';
  const canCoordinate = staffIsPse && !isClosed;
  const showWorkflowWizard = canCoordinate;
  const needsAssignmentForAdmin = staffIsAdmin && !staffIsPse && !isAssigned && !isClosed;
  const adminViewingAssigned = staffIsAdmin && !staffIsPse && isAssigned && !isClosed;
  const assignedExecutiveName =
    request.assigned_to_name ??
    executives.find((executive) => executive.id === request.assigned_to)?.full_name ??
    null;
  const statusColor = requestStatusColor(request);
  const initials = patientInitials(request.patient_name);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title='Request coordination'
      position='right'
      size='60%'
      radius='md'
      padding={0}
      classNames={{
        content: 'doctors-mgmt-drawer request-detail-drawer',
        header: 'request-detail-drawer__mantine-header',
        title: 'request-detail-drawer__mantine-title',
        body: 'doctors-mgmt-drawer__body request-detail-drawer__body',
        close: 'request-detail-drawer__close'
      }}
    >
      <div className='request-detail-drawer__shell'>
        <header className='request-detail-drawer__hero'>
          <div className='request-detail-drawer__hero-accent' aria-hidden />
          <div className='request-detail-drawer__hero-inner'>
            <div className='request-detail-drawer__patient'>
              <div className='request-detail-drawer__avatar' aria-hidden>
                {initials}
              </div>
              <div className='request-detail-drawer__patient-meta'>
                <Text component='h2' className='request-detail-drawer__patient-name'>
                  {request.patient_name ?? 'Patient'}
                </Text>
                {request.patient_email ? (
                  <span className='request-detail-drawer__meta-row'>
                    <IconMail size={14} stroke={1.75} aria-hidden />
                    <Text component='span' size='sm' className='request-detail-drawer__meta-text'>
                      {request.patient_email}
                    </Text>
                  </span>
                ) : null}
                <span className='request-detail-drawer__meta-row'>
                  <IconClock size={14} stroke={1.75} aria-hidden />
                  <Text component='span' size='sm' className='request-detail-drawer__meta-text'>
                    Submitted {formatRequestDate(request.created_at)}
                  </Text>
                </span>
                {request.doctor_name ? (
                  <span className='request-detail-drawer__meta-row'>
                    <IconUser size={14} stroke={1.75} aria-hidden />
                    <Text component='span' size='sm' className='request-detail-drawer__meta-text'>
                      Initial doctor: {request.doctor_name}
                      {request.doctor_specialty ? ` · ${request.doctor_specialty}` : ''}
                    </Text>
                  </span>
                ) : null}
              </div>
            </div>
            <Badge
              variant='light'
              color={statusColor}
              radius='xl'
              size='lg'
              className={`request-detail-drawer__status doctors-mgmt-status request-detail-drawer__status--${statusColor}`}
            >
              {staffRequestStatusLabel(request)}
            </Badge>
          </div>
          {isClosed ? (
            <div className='request-detail-drawer__closed-banner' role='status'>
              <IconCalendar size={16} stroke={1.75} aria-hidden />
              <Text size='sm'>This request is closed. Coordination steps are read-only.</Text>
            </div>
          ) : null}
        </header>

        <div className='request-detail-drawer__content'>
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

          {canAssign ? (
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
                    Hand off coordination to your team member.
                  </Text>
                </div>
              </div>
              <Select
                placeholder='Select executive…'
                data={executives.map((executive) => ({
                  value: executive.id,
                  label: executive.full_name
                }))}
                value={assigneeId || null}
                onChange={(value) => onAssigneeChange(value ?? '')}
                searchable
                radius='md'
                size='md'
                classNames={{ input: 'request-detail-drawer__select-input' }}
              />
              <Button
                radius='md'
                size='md'
                fullWidth
                className='doctors-mgmt-header__primary request-detail-drawer__assign-btn'
                disabled={busy || !assigneeId || executives.length === 0}
                loading={busy}
                onClick={onAssign}
                rightSection={<IconArrowRight size={18} stroke={1.75} />}
              >
                Assign request
              </Button>
            </section>
          ) : null}

          {showWorkflowWizard ? (
            <section className='request-detail-drawer__workflow'>
              <div className='request-detail-drawer__workflow-head'>
                <ThemeIcon size={32} radius='md' variant='light' color='cyan'>
                  <IconCheck size={18} stroke={1.75} />
                </ThemeIcon>
                <div>
                  <Text fw={600} size='sm'>
                    Coordination workflow
                  </Text>
                  <Text size='xs' c='dimmed'>
                    Complete each step to move the consultation forward.
                  </Text>
                </div>
              </div>
              <RequestWorkflowWizard
                key={request.id}
                request={request}
                doctors={doctors}
                canCoordinate={canCoordinate}
                onOpenRecord={onOpenRecord}
                onUpdated={onWorkflowUpdated}
                onError={onError}
                onSuccess={onSuccess}
              />
            </section>
          ) : null}
        </div>
      </div>
    </Drawer>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, UserCog, Users } from 'lucide-react';
import SectionCard from '../../components/ui/SectionCard';
import { manageStaffMember } from '../../lib/adminAuth';
import { fetchAllAdmins } from '../../lib/admins';
import { isAdministrator } from '../../lib/staffPermissions';
import type { Admin } from '../../types/admin';
import StaffFormModal from './forms/StaffFormModal';
import { useElixHealthStaff } from './ElixHealthStaffContext';

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

function StaffTable({
  members,
  showActions,
  busyId,
  onEdit,
  onToggleActive
}: {
  members: Admin[];
  showActions: boolean;
  busyId: string | null;
  onEdit: (member: Admin) => void;
  onToggleActive: (member: Admin) => void;
}) {
  if (members.length === 0) {
    return <p className='muted'>No accounts in this group.</p>;
  }

  return (
    <div className='elixhealth-table-wrap'>
      <table className='elixhealth-table'>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Clinic</th>
            <th>Status</th>
            <th>Auth linked</th>
            <th>Created</th>
            {showActions ? <th aria-label='Actions'>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td>{member.full_name}</td>
              <td>{member.email}</td>
              <td>{member.clinic_name ?? '—'}</td>
              <td>
                <span className={member.is_active ? 'elixhealth-badge elixhealth-badge--ok' : 'elixhealth-badge'}>
                  {member.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>{member.auth_user_id ? 'Yes' : 'No'}</td>
              <td>{formatDate(member.created_at)}</td>
              {showActions ? (
                <td>
                  <div className='elixhealth-table-actions'>
                    <button
                      type='button'
                      className='elixhealth-row-action'
                      disabled={busyId === member.id}
                      onClick={() => onEdit(member)}
                    >
                      <Pencil size={14} aria-hidden />
                      Edit
                    </button>
                    <button
                      type='button'
                      className='elixhealth-row-action'
                      disabled={busyId === member.id}
                      onClick={() => onToggleActive(member)}
                    >
                      {busyId === member.id ? (
                        <Loader2 size={14} className='spin' aria-hidden />
                      ) : member.is_active ? (
                        'Deactivate'
                      ) : (
                        'Activate'
                      )}
                    </button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ElixHealthStaffPage() {
  const { staff: currentStaff } = useElixHealthStaff();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [staff, setStaff] = useState<Admin[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingStaff, setEditingStaff] = useState<Admin | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await fetchAllAdmins();
    if (fetchError) {
      setError(fetchError.message);
      setStaff([]);
    } else {
      setStaff(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const administrators = useMemo(
    () => staff.filter((member) => member.role === 'administrator'),
    [staff]
  );
  const executives = useMemo(
    () => staff.filter((member) => member.role === 'patient_service_executive'),
    [staff]
  );
  const clinicExecutives = useMemo(
    () => staff.filter((member) => member.role === 'patient_service_executive_clinic'),
    [staff]
  );

  const openCreateModal = () => {
    setModalMode('create');
    setEditingStaff(null);
    setModalOpen(true);
  };

  const openEditModal = (member: Admin) => {
    setModalMode('edit');
    setEditingStaff(member);
    setModalOpen(true);
  };

  const handleToggleActive = async (member: Admin) => {
    setBusyId(member.id);
    setActionMessage(null);
    const { error: manageError } = await manageStaffMember(
      member.id,
      member.is_active ? 'deactivate' : 'activate'
    );
    setBusyId(null);

    if (manageError) {
      setActionMessage(manageError);
      return;
    }

    setActionMessage(`${member.full_name} is now ${member.is_active ? 'inactive' : 'active'}.`);
    void load();
  };

  if (loading) {
    return (
      <p className='elixhealth-status'>
        <Loader2 size={18} className='spin' aria-hidden /> Loading staff…
      </p>
    );
  }

  if (error) {
    return (
      <p className='auth-error' role='alert'>
        {error}
      </p>
    );
  }

  return (
    <div className='elixhealth-staff-page'>
      {actionMessage ? (
        <p className='elixhealth-success' role='status'>
          {actionMessage}
        </p>
      ) : null}

      {isAdministrator(currentStaff) ? (
        <div className='elixhealth-staff-toolbar elixhealth-staff-toolbar--page'>
          <p className='muted'>
            Add new staff accounts for the Elix Health console.
          </p>
          <button type='button' className='primary-btn' onClick={openCreateModal}>
            <Plus size={16} aria-hidden />
            Add staff
          </button>
        </div>
      ) : null}

      <SectionCard
        title='Administrators'
        subtitle={`${administrators.length} administrator account${administrators.length === 1 ? '' : 's'}`}
      >
        <StaffTable
          members={administrators}
          showActions={false}
          busyId={busyId}
          onEdit={() => {}}
          onToggleActive={() => {}}
        />
      </SectionCard>

      <SectionCard
        title='Patient Service Executives'
        subtitle={`${executives.length} staff account${executives.length === 1 ? '' : 's'} coordinating requests`}
      >
        <p className='muted elixhealth-staff-note'>
          <Users size={16} className='inline-icon' aria-hidden /> Assign incoming requests to active executives from the Requests page.
        </p>

        <StaffTable
          members={executives}
          showActions={isAdministrator(currentStaff)}
          busyId={busyId}
          onEdit={openEditModal}
          onToggleActive={(member) => void handleToggleActive(member)}
        />
      </SectionCard>

      <SectionCard
        title='Patient Service Executives (clinic)'
        subtitle={`${clinicExecutives.length} isolated clinic account${clinicExecutives.length === 1 ? '' : 's'}`}
      >
        <p className='muted elixhealth-staff-note'>
          <UserCog size={16} className='inline-icon' aria-hidden /> Clinic executives manage isolated patients and doctors for their workspace. Administrators can view all clinic data on the Patients and Doctors pages.
        </p>
        {clinicExecutives.length === 0 ? (
          <p className='muted elixhealth-staff-note'>
            If a clinic account was created before migration 045, it may appear under Patient Service
            Executives above. Re-add the same email with role &quot;Patient Service Executive (clinic)&quot; or
            run <code>supabase/repair-clinic-pse-account.sql</code> in Supabase SQL Editor.
          </p>
        ) : null}

        <StaffTable
          members={clinicExecutives}
          showActions={isAdministrator(currentStaff)}
          busyId={busyId}
          onEdit={openEditModal}
          onToggleActive={(member) => void handleToggleActive(member)}
        />
      </SectionCard>

      <StaffFormModal
        open={modalOpen}
        mode={modalMode}
        staff={editingStaff}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setActionMessage(
            modalMode === 'edit'
              ? `${editingStaff?.full_name ?? 'Staff member'} updated.`
              : 'Staff account created.'
          );
          void load();
        }}
      />
    </div>
  );
}

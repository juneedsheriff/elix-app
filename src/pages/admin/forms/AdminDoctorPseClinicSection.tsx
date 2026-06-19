import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Group, Select, Stack, Text } from '@mantine/core';
import SectionCard from '../../../components/ui/SectionCard';
import {
  fetchDoctorWorkspaceGrantsForDoctor,
  fetchPseClinicsForAdmin,
  grantDoctorToClinicForAdmin,
  removeDoctorFromClinicWorkspace
} from '../../../lib/clinicDoctorRequests';
import type { Doctor } from '../../../types/doctor';
import type { DoctorWorkspaceLink } from '../../../types/clinicDoctorRequest';

type AdminDoctorPseClinicSectionProps = {
  doctor: Doctor;
};

export default function AdminDoctorPseClinicSection({ doctor }: AdminDoctorPseClinicSectionProps) {
  const [clinics, setClinics] = useState<Array<{ id: string; name: string }>>([]);
  const [grants, setGrants] = useState<DoctorWorkspaceLink[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isPlatformDoctor = !doctor.clinic_id;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [clinicsRes, grantsRes] = await Promise.all([
      fetchPseClinicsForAdmin(),
      fetchDoctorWorkspaceGrantsForDoctor(doctor.id)
    ]);

    if (clinicsRes.error) {
      setError(clinicsRes.error.message);
      setClinics([]);
    } else {
      setClinics(clinicsRes.data ?? []);
    }

    if (grantsRes.error) {
      setError(grantsRes.error.message);
      setGrants([]);
    } else {
      setGrants(grantsRes.data ?? []);
    }

    setLoading(false);
  }, [doctor.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const clinicOptions = useMemo(() => {
    const grantedIds = new Set(grants.map((grant) => grant.clinicId));
    return clinics
      .filter((clinic) => !grantedIds.has(clinic.id))
      .map((clinic) => ({ value: clinic.id, label: clinic.name }));
  }, [clinics, grants]);

  const handleGrant = async () => {
    if (!selectedClinicId) {
      setError('Select a clinic workspace.');
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    const { error: grantError } = await grantDoctorToClinicForAdmin(doctor.id, selectedClinicId);
    setBusy(false);

    if (grantError) {
      setError(grantError.message);
      return;
    }

    const clinicName = clinics.find((clinic) => clinic.id === selectedClinicId)?.name ?? 'clinic';
    setMessage(`Added ${doctor.full_name} to ${clinicName}.`);
    setSelectedClinicId(null);
    void load();
  };

  const handleRemove = async (link: DoctorWorkspaceLink) => {
    if (
      !window.confirm(
        `Remove ${doctor.full_name} from ${link.clinicName}? The clinic PSE will no longer see this doctor.`
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    const { error: removeError } = await removeDoctorFromClinicWorkspace(doctor.id, link.clinicId);
    setBusy(false);

    if (removeError) {
      setError(removeError.message);
      return;
    }

    setMessage(`Removed ${doctor.full_name} from ${link.clinicName}.`);
    void load();
  };

  if (loading) {
    return (
      <SectionCard title='PSE clinic access' subtitle='Loading clinic workspaces…'>
        <Text size='sm' c='dimmed'>
          Loading…
        </Text>
      </SectionCard>
    );
  }

  if (!isPlatformDoctor) {
    return (
      <SectionCard title='PSE clinic access' subtitle='Clinic-owned doctor profile'>
        <Text size='sm' c='dimmed'>
          This doctor was created in the clinic PSE workspace
          {doctor.pse_clinic_name ? ` (${doctor.pse_clinic_name})` : ''}. Platform grant linking does not
          apply — manage visibility from the doctors list or delete the profile to remove from that clinic.
        </Text>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title='PSE clinic access'
      subtitle='Allow clinic Patient Service Executive teams to use this platform doctor'
    >
      <Stack gap='md'>
        <Text size='sm' c='dimmed'>
          Add this doctor to a clinic workspace so the clinic PSE can coordinate opinion requests. This is
          the same as approving a clinic doctor request.
        </Text>

        {error ? (
          <Text size='sm' c='red' role='alert'>
            {error}
          </Text>
        ) : null}

        {message ? (
          <Text size='sm' c='teal' role='status'>
            {message}
          </Text>
        ) : null}

        {grants.length > 0 ? (
          <Stack gap='xs'>
            <Text size='sm' fw={600}>
              Linked clinics
            </Text>
            {grants.map((grant) => (
              <Group key={grant.clinicId} justify='space-between' wrap='wrap'>
                <Group gap='xs'>
                  <Text size='sm' fw={500}>
                    {grant.clinicName}
                  </Text>
                  <Badge size='sm' variant='light' color='blue'>
                    Platform grant
                  </Badge>
                </Group>
                <Button
                  size='compact-sm'
                  variant='light'
                  color='red'
                  radius='md'
                  disabled={busy}
                  onClick={() => void handleRemove(grant)}
                >
                  Remove
                </Button>
              </Group>
            ))}
          </Stack>
        ) : (
          <Text size='sm' c='dimmed'>
            Not linked to any clinic workspace yet.
          </Text>
        )}

        {clinicOptions.length > 0 ? (
          <Group align='flex-end' gap='sm' wrap='wrap'>
            <Select
              label='Add to clinic'
              placeholder='Select clinic workspace'
              data={clinicOptions}
              value={selectedClinicId}
              onChange={setSelectedClinicId}
              searchable
              nothingFoundMessage='No clinics available'
              disabled={busy}
              radius='md'
              style={{ flex: 1, minWidth: 220 }}
            />
            <Button
              radius='md'
              className='doctors-mgmt-header__primary'
              disabled={busy || !selectedClinicId}
              loading={busy}
              onClick={() => void handleGrant()}
            >
              Add to clinic
            </Button>
          </Group>
        ) : clinics.length === 0 ? (
          <Text size='sm' c='dimmed'>
            No clinic workspaces exist yet. Create a clinic PSE staff account first.
          </Text>
        ) : (
          <Text size='sm' c='dimmed'>
            This doctor is already linked to all clinic workspaces.
          </Text>
        )}
      </Stack>
    </SectionCard>
  );
}

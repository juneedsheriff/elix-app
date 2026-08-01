import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Group, Select, Stack, Text } from '@mantine/core';
import SectionCard from '../../../components/ui/SectionCard';
import {
  assignPatientToClinicForAdmin,
  removePatientFromClinicForAdmin
} from '../../../lib/admins';
import { fetchPseClinicsForAdmin } from '../../../lib/clinicDoctorRequests';
import type { Patient } from '../../../types/patient';

type AdminPatientPseClinicSectionProps = {
  patient: Patient;
  onAssigned: (patient: Patient) => void;
};

export default function AdminPatientPseClinicSection({
  patient,
  onAssigned
}: AdminPatientPseClinicSectionProps) {
  const [clinics, setClinics] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await fetchPseClinicsForAdmin();
    setLoading(false);

    if (fetchError) {
      setError(fetchError.message);
      setClinics([]);
      return;
    }
    setClinics(data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const clinicOptions = useMemo(
    () =>
      clinics
        .filter((clinic) => clinic.id !== patient.clinic_id)
        .map((clinic) => ({ value: clinic.id, label: clinic.name })),
    [clinics, patient.clinic_id]
  );

  const handleAssign = async () => {
    if (!selectedClinicId) {
      setError('Select a clinic workspace.');
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    const { data, transferredRequests, error: assignError } = await assignPatientToClinicForAdmin(
      patient.id,
      selectedClinicId
    );

    setBusy(false);

    if (assignError || !data) {
      setError(assignError?.message ?? 'Could not assign patient to clinic.');
      return;
    }

    const clinicName =
      data.pse_clinic_name?.trim() ||
      clinics.find((clinic) => clinic.id === selectedClinicId)?.name ||
      'clinic';
    const requestNote =
      transferredRequests > 0
        ? ` Moved ${transferredRequests} opinion request${transferredRequests === 1 ? '' : 's'}.`
        : '';

    setMessage(`Assigned to ${clinicName}.${requestNote}`);
    setSelectedClinicId(null);
    onAssigned(data);
  };

  const handleRemove = async () => {
    if (
      !window.confirm(
        `Return ${patient.full_name} to Global Patients? The clinic PSE will no longer manage this patient.`
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    const { data, transferredRequests, error: removeError } = await removePatientFromClinicForAdmin(
      patient.id
    );

    setBusy(false);

    if (removeError || !data) {
      setError(removeError?.message ?? 'Could not remove clinic assignment.');
      return;
    }

    const requestNote =
      transferredRequests > 0
        ? ` Moved ${transferredRequests} opinion request${transferredRequests === 1 ? '' : 's'} back to Global.`
        : '';

    setMessage(`Returned to Global Patients.${requestNote}`);
    setSelectedClinicId(null);
    onAssigned(data);
  };

  const currentClinicName =
    patient.pse_clinic_name?.trim() ||
    clinics.find((clinic) => clinic.id === patient.clinic_id)?.name ||
    'Clinic workspace';

  if (loading) {
    return (
      <SectionCard title='PSE clinic assignment' subtitle='Loading clinic workspaces…'>
        <Text size='sm' c='dimmed'>
          Loading…
        </Text>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title='PSE clinic assignment'
      subtitle='Move self-registered global patients to a clinic PSE workspace'
    >
      <Stack gap='md'>
        <Group gap='sm' wrap='wrap'>
          {patient.clinic_id ? (
            <>
              <Text size='sm' fw={600}>
                {currentClinicName}
              </Text>
              <Badge size='sm' variant='light' color='teal'>
                Clinic patient
              </Badge>
            </>
          ) : (
            <>
              <Text size='sm' fw={600}>
                Platform (Global)
              </Text>
              <Badge size='sm' variant='light' color='gray'>
                Global patient
              </Badge>
            </>
          )}
        </Group>

        <Text size='sm' c='dimmed'>
          After assignment, this patient appears in the clinic PSE patient list. They can browse
          clinic doctors (including home care) and the clinic handles case management. Existing
          opinion requests move with the patient. You can also return them to Global.
        </Text>

        {error ? (
          <Alert color='red' radius='md'>
            {error}
          </Alert>
        ) : null}

        {message ? (
          <Alert color='teal' radius='md'>
            {message}
          </Alert>
        ) : null}

        {clinicOptions.length > 0 ? (
          <Group align='flex-end' gap='sm' wrap='wrap'>
            <Select
              label={patient.clinic_id ? 'Move to clinic' : 'Assign to clinic'}
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
              onClick={() => void handleAssign()}
            >
              {patient.clinic_id ? 'Change clinic' : 'Assign to clinic'}
            </Button>
          </Group>
        ) : clinics.length === 0 ? (
          <Text size='sm' c='dimmed'>
            No clinic workspaces exist yet. Create a clinic PSE staff account first.
          </Text>
        ) : patient.clinic_id ? null : (
          <Text size='sm' c='dimmed'>
            This patient is already assigned to the only available clinic workspace.
          </Text>
        )}

        {patient.clinic_id ? (
          <Group justify='flex-start'>
            <Button
              variant='light'
              color='orange'
              radius='md'
              disabled={busy}
              loading={busy}
              onClick={() => void handleRemove()}
            >
              Remove from clinic
            </Button>
          </Group>
        ) : null}
      </Stack>
    </SectionCard>
  );
}

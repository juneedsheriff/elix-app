import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Group, Modal, Select, Stack, Text } from '@mantine/core';
import { assignPatientToClinicForAdmin } from '../../../lib/admins';
import { fetchPseClinicsForAdmin } from '../../../lib/clinicDoctorRequests';
import type { Patient } from '../../../types/patient';

type AssignPatientToClinicModalProps = {
  patient: Patient | null;
  opened: boolean;
  onClose: () => void;
  onAssigned: (patient: Patient, clinicName: string, transferredRequests: number) => void;
};

export default function AssignPatientToClinicModal({
  patient,
  opened,
  onClose,
  onAssigned
}: AssignPatientToClinicModalProps) {
  const [clinics, setClinics] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [loadingClinics, setLoadingClinics] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;

    setSelectedClinicId(null);
    setError(null);
    setLoadingClinics(true);

    void fetchPseClinicsForAdmin().then(({ data, error: fetchError }) => {
      setLoadingClinics(false);
      if (fetchError) {
        setError(fetchError.message);
        setClinics([]);
        return;
      }
      setClinics(data ?? []);
    });
  }, [opened]);

  const clinicOptions = useMemo(
    () =>
      clinics
        .filter((clinic) => clinic.id !== patient?.clinic_id)
        .map((clinic) => ({ value: clinic.id, label: clinic.name })),
    [clinics, patient?.clinic_id]
  );

  const handleAssign = async () => {
    if (!patient) return;
    if (!selectedClinicId) {
      setError('Select a clinic workspace.');
      return;
    }

    setBusy(true);
    setError(null);

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

    onAssigned(data, clinicName, transferredRequests);
    onClose();
  };

  const isReassign = Boolean(patient?.clinic_id);

  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={isReassign ? 'Change clinic assignment' : 'Assign to clinic PSE'}
      centered
      radius='md'
    >
      <Stack gap='md'>
        <Text size='sm' c='dimmed'>
          {patient
            ? isReassign
              ? `Move ${patient.full_name} to a different clinic PSE workspace. Existing opinion requests will move with them.`
              : `Move ${patient.full_name} from Global Patients to a clinic PSE workspace. The clinic will handle future communication and case management.`
            : null}
        </Text>

        {patient?.city || patient?.country ? (
          <Text size='sm'>
            Location:{' '}
            <Text span fw={600}>
              {[patient.city, patient.country].filter(Boolean).join(', ')}
            </Text>
          </Text>
        ) : null}

        {error ? (
          <Alert color='red' radius='md'>
            {error}
          </Alert>
        ) : null}

        <Select
          label='Clinic workspace'
          placeholder={loadingClinics ? 'Loading clinics…' : 'Select clinic'}
          data={clinicOptions}
          value={selectedClinicId}
          onChange={setSelectedClinicId}
          searchable
          nothingFoundMessage='No clinics available'
          disabled={busy || loadingClinics}
          radius='md'
        />

        {!loadingClinics && clinics.length === 0 ? (
          <Text size='sm' c='dimmed'>
            No clinic workspaces exist yet. Create a clinic PSE staff account first.
          </Text>
        ) : null}

        <Group justify='flex-end' gap='sm'>
          <Button variant='default' radius='md' disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            radius='md'
            className='doctors-mgmt-header__primary'
            loading={busy}
            disabled={busy || loadingClinics || !selectedClinicId}
            onClick={() => void handleAssign()}
          >
            {isReassign ? 'Change clinic' : 'Assign to clinic'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

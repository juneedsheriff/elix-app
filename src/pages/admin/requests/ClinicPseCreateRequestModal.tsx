import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button, Group, Modal, Select, Stack, Text, Textarea } from '@mantine/core';
import ConsultationDurationSelect from '../../../components/ConsultationWorkflow/ConsultationDurationSelect';
import { createClinicPseOpinionRequest } from '../../../lib/opinionRequests';
import {
  doctorConsultationCurrency,
  getOfferedConsultationTiers
} from '../../../lib/consultationTiers';
import type { Admin } from '../../../types/admin';
import type { Doctor } from '../../../types/doctor';
import type { Patient } from '../../../types/patient';
import { FieldLabel } from '../forms/adminDoctorFormUi';

type ClinicPseCreateRequestModalProps = {
  opened: boolean;
  onClose: () => void;
  staff: Admin;
  patients: Patient[];
  doctors: Doctor[];
  onCreated: () => void;
};

export default function ClinicPseCreateRequestModal({
  opened,
  onClose,
  staff,
  patients,
  doctors,
  onCreated
}: ClinicPseCreateRequestModalProps) {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDoctor = useMemo(
    () => doctors.find((doctor) => doctor.id === doctorId) ?? null,
    [doctorId, doctors]
  );

  const durationTiers = useMemo(
    () => (selectedDoctor ? getOfferedConsultationTiers(selectedDoctor) : []),
    [selectedDoctor]
  );

  const showFees = useMemo(
    () => durationTiers.some((tier) => tier.fee_usd > 0),
    [durationTiers]
  );

  useEffect(() => {
    if (!opened) return;
    setPatientId(null);
    setDoctorId(null);
    setMessage('');
    setDurationMinutes(null);
    setError(null);
    setBusy(false);
  }, [opened]);

  useEffect(() => {
    if (!selectedDoctor) {
      setDurationMinutes(null);
      return;
    }
    const tiers = getOfferedConsultationTiers(selectedDoctor);
    setDurationMinutes((current) => {
      if (current != null && tiers.some((tier) => tier.duration_minutes === current)) {
        return current;
      }
      return tiers[0]?.duration_minutes ?? null;
    });
  }, [selectedDoctor]);

  const patientOptions = useMemo(
    () =>
      patients.map((patient) => {
        const name = patient.full_name?.trim() || 'Unnamed patient';
        const email = patient.email?.trim();
        return {
          value: patient.id,
          label: email ? `${name} (${email})` : name
        };
      }),
    [patients]
  );

  const doctorOptions = useMemo(
    () =>
      doctors.map((doctor) => ({
        value: doctor.id,
        label: doctor.specialty ? `${doctor.full_name} — ${doctor.specialty}` : doctor.full_name
      })),
    [doctors]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!staff.clinic_id) {
      setError('Your clinic workspace is not configured.');
      return;
    }
    if (!patientId) {
      setError('Select a patient.');
      return;
    }
    if (!doctorId) {
      setError('Select a doctor.');
      return;
    }

    setBusy(true);
    setError(null);

    const { error: createError } = await createClinicPseOpinionRequest({
      patientProfileId: patientId,
      doctorId,
      message,
      consultationDurationMinutes: durationMinutes,
      staffId: staff.id,
      clinicId: staff.clinic_id
    });

    setBusy(false);

    if (createError) {
      setError(createError.message);
      return;
    }

    onCreated();
    onClose();
  };

  const missingDirectory = patients.length === 0 || doctors.length === 0;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title='Add opinion request'
      radius='md'
      size='lg'
      centered
    >
      <form onSubmit={(e) => void handleSubmit(e)}>
        <Stack gap='md'>
          <Text size='sm' c='dimmed'>
            Create a consultation request from a clinic patient to a clinic doctor. The request is
            assigned to you immediately.
          </Text>

          {missingDirectory ? (
            <Text size='sm' c='orange'>
              {patients.length === 0 && doctors.length === 0
                ? 'Add patients and doctors in your clinic workspace before creating requests.'
                : patients.length === 0
                  ? 'Add at least one patient in Patients before creating a request.'
                  : 'Add at least one doctor in Doctors before creating a request.'}
            </Text>
          ) : null}

          {error ? (
            <Text size='sm' c='red' role='alert'>
              {error}
            </Text>
          ) : null}

          <label className='elixhealth-field elixhealth-field--full'>
            <FieldLabel required>Patient</FieldLabel>
            <Select
              data={patientOptions}
              value={patientId}
              onChange={setPatientId}
              placeholder='Select patient'
              searchable
              nothingFoundMessage='No patients'
              disabled={busy || patients.length === 0}
              radius='md'
            />
          </label>

          <label className='elixhealth-field elixhealth-field--full'>
            <FieldLabel required>Doctor</FieldLabel>
            <Select
              data={doctorOptions}
              value={doctorId}
              onChange={setDoctorId}
              placeholder='Select doctor'
              searchable
              nothingFoundMessage='No doctors'
              disabled={busy || doctors.length === 0}
              radius='md'
            />
          </label>

          {selectedDoctor && durationTiers.length > 0 ? (
            <ConsultationDurationSelect
              tiers={durationTiers}
              value={durationMinutes}
              onChange={setDurationMinutes}
              disabled={busy}
              showFees={showFees}
              currency={doctorConsultationCurrency(selectedDoctor)}
              hint='Optional — matches the doctor’s consultation tiers.'
            />
          ) : null}

          <label className='elixhealth-field elixhealth-field--full'>
            <FieldLabel>Chief complaint / notes</FieldLabel>
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.currentTarget.value)}
              placeholder='Brief reason for the consultation (optional)'
              minRows={3}
              disabled={busy}
              radius='md'
            />
          </label>

          <Group justify='flex-end' gap='sm'>
            <Button variant='default' radius='md' onClick={onClose} disabled={busy} type='button'>
              Cancel
            </Button>
            <Button
              type='submit'
              radius='md'
              className='doctors-mgmt-header__primary'
              loading={busy}
              disabled={missingDirectory}
            >
              Create request
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

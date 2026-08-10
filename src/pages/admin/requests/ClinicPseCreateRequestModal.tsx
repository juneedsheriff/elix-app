import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button, Group, Modal, Select, Stack, Text, Textarea } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import ConsultationTierPricingDisplay from '../../../components/Doctors/ConsultationTierPricingDisplay';
import {
  createClinicPseOpinionRequest,
  createPlatformPseOpinionRequest
} from '../../../lib/opinionRequests';
import type { Admin } from '../../../types/admin';
import type { Doctor } from '../../../types/doctor';
import type { Patient } from '../../../types/patient';
import AdminPatientCreateForm from '../forms/AdminPatientCreateForm';
import { FieldLabel } from '../forms/adminDoctorFormUi';

type ClinicPseCreateRequestModalProps = {
  opened: boolean;
  onClose: () => void;
  staff: Admin;
  patients: Patient[];
  doctors: Doctor[];
  onCreated: (requestId: string) => void;
  onPatientCreated?: (patient: Patient) => void;
  /** Pre-select this patient when the modal opens. */
  initialPatientId?: string | null;
  /** Show “Create new patient” next to the patient field. Default true when clinic workspace. */
  allowCreatePatient?: boolean;
  /** Keep the patient select read-only (use with initialPatientId). */
  lockPatient?: boolean;
};

export default function ClinicPseCreateRequestModal({
  opened,
  onClose,
  staff,
  patients,
  doctors,
  onCreated,
  onPatientCreated,
  initialPatientId = null,
  allowCreatePatient,
  lockPatient = false
}: ClinicPseCreateRequestModalProps) {
  const isCompactViewport = useMediaQuery('(max-width: 1024px)');
  const isClinicWorkspace = Boolean(staff.clinic_id);
  const allowCreatePatientButton = allowCreatePatient ?? isClinicWorkspace;
  const [patientId, setPatientId] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [createPatientOpen, setCreatePatientOpen] = useState(false);
  const [extraPatients, setExtraPatients] = useState<Patient[]>([]);

  const directoryPatients = useMemo(() => {
    if (!extraPatients.length) return patients;
    const byId = new Map(patients.map((patient) => [patient.id, patient]));
    for (const patient of extraPatients) {
      byId.set(patient.id, patient);
    }
    return [...byId.values()].sort((a, b) =>
      (a.full_name ?? '').localeCompare(b.full_name ?? '')
    );
  }, [patients, extraPatients]);

  const availableDoctors = useMemo(
    () => (isClinicWorkspace ? doctors : doctors.filter((doctor) => !doctor.clinic_id)),
    [doctors, isClinicWorkspace]
  );

  const selectedDoctor = useMemo(
    () => availableDoctors.find((doctor) => doctor.id === doctorId) ?? null,
    [doctorId, availableDoctors]
  );

  useEffect(() => {
    if (!opened) return;
    setPatientId(initialPatientId);
    setDoctorId(null);
    setMessage('');
    setError(null);
    setInfoMessage(null);
    setBusy(false);
    setCreatePatientOpen(false);
    setExtraPatients([]);
  }, [opened, initialPatientId]);

  const patientOptions = useMemo(
    () =>
      directoryPatients.map((patient) => {
        const name = patient.full_name?.trim() || 'Unnamed patient';
        const email = patient.email?.trim();
        return {
          value: patient.id,
          label: email ? `${name} (${email})` : name
        };
      }),
    [directoryPatients]
  );

  const doctorOptions = useMemo(
    () =>
      availableDoctors.map((doctor) => ({
        value: doctor.id,
        label: doctor.specialty ? `${doctor.full_name} — ${doctor.specialty}` : doctor.full_name
      })),
    [availableDoctors]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!patientId) {
      setError('Select a patient.');
      return;
    }
    if (!doctorId) {
      setError('Select a doctor.');
      return;
    }
    if (isClinicWorkspace && !staff.clinic_id) {
      setError('Your clinic workspace is not configured.');
      return;
    }

    setBusy(true);
    setError(null);

    const { data: created, error: createError } = isClinicWorkspace
      ? await createClinicPseOpinionRequest({
          patientProfileId: patientId,
          doctorId,
          message,
          staffId: staff.id,
          clinicId: staff.clinic_id as string
        })
      : await createPlatformPseOpinionRequest({
          patientProfileId: patientId,
          doctorId,
          message,
          staffId: staff.id
        });

    setBusy(false);

    if (createError || !created?.id) {
      setError(createError?.message ?? 'Could not create request.');
      return;
    }

    onCreated(created.id);
    onClose();
  };

  const noDoctors = availableDoctors.length === 0;
  const canSubmit = Boolean(patientId && doctorId && (!isClinicWorkspace || staff.clinic_id));

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title='Add Consultation Request'
        radius={isCompactViewport ? 0 : 'md'}
        size={isCompactViewport ? '100%' : 'lg'}
        fullScreen={isCompactViewport}
        centered
        zIndex={400}
        classNames={{ content: 'doctors-mgmt-modal requests-create-modal' }}
      >
        <form onSubmit={(e) => void handleSubmit(e)}>
          <Stack gap='md'>
            <Text size='sm' c='dimmed'>
              {isClinicWorkspace
                ? 'Create a consultation request from a clinic patient to a clinic doctor. The request is assigned to you immediately.'
                : 'Create a consultation request from a platform patient to a platform doctor. The request is assigned to you immediately.'}
            </Text>

            {noDoctors ? (
              <Text size='sm' c='orange'>
                Add at least one doctor in Doctors before creating a request.
              </Text>
            ) : null}

            {error ? (
              <Text size='sm' c='red' role='alert'>
                {error}
              </Text>
            ) : null}

            {infoMessage ? (
              <Text size='sm' c='orange' role='status'>
                {infoMessage}
              </Text>
            ) : null}

            <div className='elixhealth-field elixhealth-field--full'>
              {allowCreatePatientButton ? (
                <Group justify='space-between' align='center' wrap='wrap' gap='sm' mb={6}>
                  <FieldLabel required>Patient</FieldLabel>
                  <Button
                    type='button'
                    radius='md'
                    size='sm'
                    variant='outline'
                    color='cyan'
                    leftSection={<IconPlus size={16} />}
                    disabled={busy || !staff.clinic_id}
                    onClick={() => setCreatePatientOpen(true)}
                  >
                    Create new patient
                  </Button>
                </Group>
              ) : (
                <FieldLabel required>Patient</FieldLabel>
              )}
              <Select
                data={patientOptions}
                value={patientId}
                onChange={setPatientId}
                placeholder={
                  directoryPatients.length ? 'Select patient' : 'No patients yet — create one'
                }
                searchable
                nothingFoundMessage='No matching patients'
                disabled={busy || lockPatient}
                radius='md'
                comboboxProps={{ withinPortal: true, zIndex: 460 }}
              />
            </div>

            <div className='elixhealth-field elixhealth-field--full'>
              <FieldLabel required>Doctor</FieldLabel>
              <Select
                data={doctorOptions}
                value={doctorId}
                onChange={setDoctorId}
                placeholder='Select doctor'
                searchable
                nothingFoundMessage='No doctors'
                disabled={busy || noDoctors}
                radius='md'
                comboboxProps={{ withinPortal: true, zIndex: 460 }}
              />
            </div>

            {selectedDoctor ? (
              <div className='elixhealth-field elixhealth-field--full'>
                <FieldLabel>Consultation charge</FieldLabel>
                <ConsultationTierPricingDisplay doctor={selectedDoctor} />
              </div>
            ) : null}

            <div className='elixhealth-field elixhealth-field--full'>
              <FieldLabel>Chief complaint / notes</FieldLabel>
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.currentTarget.value)}
                placeholder='Brief reason for the consultation (optional)'
                minRows={3}
                disabled={busy}
                radius='md'
              />
            </div>

            <Group justify='flex-end' gap='sm'>
              <Button variant='default' radius='md' onClick={onClose} disabled={busy} type='button'>
                Cancel
              </Button>
              <Button
                type='submit'
                radius='md'
                className='doctors-mgmt-header__primary'
                loading={busy}
                disabled={!canSubmit}
              >
                Create request
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {allowCreatePatientButton && staff.clinic_id ? (
        <Modal
          opened={createPatientOpen}
          onClose={() => setCreatePatientOpen(false)}
          title='Create patient'
          radius={isCompactViewport ? 0 : 'md'}
          size={isCompactViewport ? '100%' : 'lg'}
          fullScreen={isCompactViewport}
          centered
          zIndex={450}
          classNames={{ content: 'doctors-mgmt-modal' }}
        >
          <AdminPatientCreateForm
            clinicId={staff.clinic_id}
            onCancel={() => setCreatePatientOpen(false)}
            onCreated={({ patient, warning }) => {
              setExtraPatients((prev) =>
                prev.some((item) => item.id === patient.id) ? prev : [patient, ...prev]
              );
              onPatientCreated?.(patient);
              setPatientId(patient.id);
              setCreatePatientOpen(false);
              setError(null);
              setInfoMessage(
                warning
                  ? `Patient selected. ${warning}`
                  : 'Patient created and selected for this request.'
              );
            }}
          />
        </Modal>
      ) : null}
    </>
  );
}

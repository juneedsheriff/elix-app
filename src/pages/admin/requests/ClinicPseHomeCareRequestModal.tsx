import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Group, Modal, Select, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { createHomeCareOpinionRequest } from '../../../lib/opinionRequests';
import {
  HOME_CARE_SERVICE_OPTIONS,
  type HomeCareServiceId,
  type HomeCareServiceSelection
} from '../../../lib/homeCareServices';
import type { Admin } from '../../../types/admin';
import type { Patient } from '../../../types/patient';

type ClinicPseHomeCareRequestModalProps = {
  opened: boolean;
  onClose: () => void;
  staff: Admin;
  patients: Patient[];
  onCreated: () => void;
};

export default function ClinicPseHomeCareRequestModal({
  opened,
  onClose,
  staff,
  patients,
  onCreated
}: ClinicPseHomeCareRequestModalProps) {
  const isCompactViewport = useMediaQuery('(max-width: 1024px)');
  const [patientId, setPatientId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<HomeCareServiceId>>(new Set());
  const [otherNote, setOtherNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    setPatientId(null);
    setSelected(new Set());
    setOtherNote('');
    setError(null);
    setBusy(false);
  }, [opened]);

  const patientOptions = useMemo(
    () =>
      patients
        .filter((patient) => patient.auth_user_id)
        .map((patient) => {
          const name = patient.full_name?.trim() || 'Unnamed patient';
          const email = patient.email?.trim();
          return {
            value: patient.id,
            label: email ? `${name} (${email})` : name
          };
        }),
    [patients]
  );

  const toggle = (id: HomeCareServiceId) => {
    setError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (id === 'others') setOtherNote('');
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!staff.clinic_id) {
      setError('Your staff account is not linked to a clinic workspace.');
      return;
    }

    const patient = patients.find((row) => row.id === patientId);
    if (!patient?.auth_user_id) {
      setError('Select a clinic patient with an active login.');
      return;
    }

    const selection: HomeCareServiceSelection = {
      serviceIds: HOME_CARE_SERVICE_OPTIONS.map((option) => option.id).filter((id) =>
        selected.has(id)
      ),
      otherNote
    };

    if (!selection.serviceIds.length) {
      setError('Select at least one home care service.');
      return;
    }
    if (selection.serviceIds.includes('others') && !otherNote.trim()) {
      setError('Please describe the other home care service needed.');
      return;
    }

    setBusy(true);
    setError(null);

    const { error: createError } = await createHomeCareOpinionRequest({
      patientAuthUserId: patient.auth_user_id,
      patientName: patient.full_name,
      selection,
      clinicId: staff.clinic_id,
      staffId: staff.id,
      actor: 'pse'
    });

    setBusy(false);

    if (createError) {
      setError(createError.message);
      return;
    }

    onCreated();
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (!busy) onClose();
      }}
      title='Home Care Services'
      radius={isCompactViewport ? 0 : 'lg'}
      size={isCompactViewport ? '100%' : 'lg'}
      fullScreen={isCompactViewport}
      centered
      zIndex={400}
      classNames={{ content: 'doctors-mgmt-modal requests-create-modal' }}
    >
      <Stack gap='md'>
        <Text size='sm' c='dimmed'>
          Choose one or more home care service categories for a clinic patient. The request is
          assigned to you for coordination.
        </Text>

        <Select
          label='Patient'
          placeholder='Select clinic patient'
          data={patientOptions}
          value={patientId}
          onChange={setPatientId}
          searchable
          nothingFoundMessage='No patients with login found'
          disabled={busy}
          radius='md'
          comboboxProps={{ withinPortal: true, zIndex: 460 }}
        />

        <Stack gap='xs'>
          <Text size='sm' fw={600}>
            Service categories
          </Text>
          {HOME_CARE_SERVICE_OPTIONS.map((option) => {
            const checked = selected.has(option.id);
            return (
              <label
                key={option.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.55rem 0.7rem',
                  borderRadius: 10,
                  border: checked ? '1px solid #09abc0' : '1px solid #e2e8f0',
                  background: checked ? 'rgba(9, 171, 192, 0.08)' : '#fff',
                  cursor: 'pointer'
                }}
              >
                <input
                  type='checkbox'
                  checked={checked}
                  disabled={busy}
                  onChange={() => toggle(option.id)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </Stack>

        {selected.has('others') ? (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Text size='sm' fw={600}>
              Describe other service
            </Text>
            <textarea
              value={otherNote}
              onChange={(event) => {
                setError(null);
                setOtherNote(event.target.value);
              }}
              rows={3}
              disabled={busy}
              placeholder='Tell us what home care support is needed…'
              style={{
                width: '100%',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                padding: '0.65rem 0.75rem',
                font: 'inherit'
              }}
            />
          </label>
        ) : null}

        {error ? (
          <Alert color='red' radius='md'>
            {error}
          </Alert>
        ) : null}

        <Group justify='flex-end' gap='sm'>
          <Button variant='default' radius='md' disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            radius='md'
            className='doctors-mgmt-header__primary'
            loading={busy}
            disabled={busy || !patientId || selected.size === 0}
            onClick={() => void handleSubmit()}
          >
            Create home care request
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

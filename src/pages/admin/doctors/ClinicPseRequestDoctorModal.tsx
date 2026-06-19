import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  Textarea,
  TextInput
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import {
  clinicDoctorRequestStatusLabel,
  fetchClinicDoctorRequestsForClinic,
  searchPlatformDoctorsForClinicPse,
  submitClinicDoctorRequest
} from '../../../lib/clinicDoctorRequests';
import type { Admin } from '../../../types/admin';
import type { ClinicDoctorRequest, PlatformDoctorSearchResult } from '../../../types/clinicDoctorRequest';

type ClinicPseRequestDoctorModalProps = {
  opened: boolean;
  onClose: () => void;
  staff: Admin;
  existingDoctorIds: Set<string>;
  onSubmitted: () => void;
};

export default function ClinicPseRequestDoctorModal({
  opened,
  onClose,
  staff,
  existingDoctorIds,
  onSubmitted
}: ClinicPseRequestDoctorModalProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<PlatformDoctorSearchResult[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<PlatformDoctorSearchResult | null>(null);
  const [message, setMessage] = useState('');
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<ClinicDoctorRequest[]>([]);

  const loadPending = useCallback(async () => {
    const { data } = await fetchClinicDoctorRequestsForClinic();
    setPendingRequests((data ?? []).filter((request) => request.status === 'pending'));
  }, []);

  useEffect(() => {
    if (!opened) return;
    setSearch('');
    setResults([]);
    setSelectedDoctor(null);
    setMessage('');
    setError(null);
    void loadPending();
  }, [opened, loadPending]);

  const pendingDoctorIds = useMemo(
    () => new Set(pendingRequests.map((request) => request.doctor_id)),
    [pendingRequests]
  );

  const runSearch = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!search.trim()) {
      setError('Enter a name, specialty, or email to search.');
      return;
    }

    setSearching(true);
    setError(null);
    const { data, error: searchError } = await searchPlatformDoctorsForClinicPse(search);
    setSearching(false);

    if (searchError) {
      setError(searchError.message);
      setResults([]);
      return;
    }

    setResults(data ?? []);
    setSelectedDoctor(null);
    if (!data?.length) {
      setError('No platform doctors matched your search.');
    }
  };

  const handleSubmit = async () => {
    if (!staff.clinic_id) {
      setError('Your clinic workspace is not configured.');
      return;
    }
    if (!selectedDoctor) {
      setError('Select a doctor from the search results.');
      return;
    }

    setBusy(true);
    setError(null);

    const { error: submitError } = await submitClinicDoctorRequest({
      clinicId: staff.clinic_id,
      doctorId: selectedDoctor.id,
      staffId: staff.id,
      message
    });

    setBusy(false);

    if (submitError) {
      setError(submitError.message);
      return;
    }

    onSubmitted();
    onClose();
  };

  const doctorState = (doctorId: string) => {
    if (existingDoctorIds.has(doctorId)) return 'available' as const;
    if (pendingDoctorIds.has(doctorId)) return 'pending' as const;
    return 'requestable' as const;
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title='Request doctor from platform'
      radius='md'
      size='lg'
      centered
    >
      <Stack gap='md'>
        <Text size='sm' c='dimmed'>
          Search the Elix Health doctor directory. Your request goes to the administrator for
          approval. Once approved, the doctor appears in your clinic list.
        </Text>

        {error ? (
          <Alert color='red' radius='md'>
            {error}
          </Alert>
        ) : null}

        <form onSubmit={(e) => void runSearch(e)}>
          <Group align='flex-end' gap='sm'>
            <TextInput
              label='Search doctors'
              placeholder='Name, specialty, email, clinic…'
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              style={{ flex: 1 }}
              radius='md'
              disabled={searching || busy}
            />
            <Button
              type='submit'
              radius='md'
              leftSection={<IconSearch size={16} />}
              loading={searching}
              disabled={busy}
            >
              Search
            </Button>
          </Group>
        </form>

        {results.length > 0 ? (
          <Stack gap='xs'>
            <Text size='sm' fw={600}>
              Results
            </Text>
            {results.map((doctor) => {
              const state = doctorState(doctor.id);
              const isSelected = selectedDoctor?.id === doctor.id;
              return (
                <button
                  key={doctor.id}
                  type='button'
                  className={
                    isSelected
                      ? 'elixhealth-doctor-search-option elixhealth-doctor-search-option--selected'
                      : 'elixhealth-doctor-search-option'
                  }
                  disabled={state !== 'requestable' || busy}
                  onClick={() => setSelectedDoctor(doctor)}
                >
                  <Stack gap={2} align='flex-start'>
                    <Group gap='xs'>
                      <Text fw={600} size='sm'>
                        {doctor.full_name}
                      </Text>
                      {state === 'available' ? (
                        <Badge size='xs' color='teal' variant='light'>
                          Already in clinic
                        </Badge>
                      ) : null}
                      {state === 'pending' ? (
                        <Badge size='xs' color='orange' variant='light'>
                          Request pending
                        </Badge>
                      ) : null}
                    </Group>
                    <Text size='xs' c='dimmed'>
                      {[doctor.specialty, doctor.clinic_name, doctor.clinic_city, doctor.email]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </Stack>
                </button>
              );
            })}
          </Stack>
        ) : null}

        {selectedDoctor ? (
          <Textarea
            label='Note for administrator (optional)'
            placeholder='Why this doctor should be added to your clinic workspace'
            value={message}
            onChange={(event) => setMessage(event.currentTarget.value)}
            minRows={2}
            radius='md'
            disabled={busy}
          />
        ) : null}

        {pendingRequests.length > 0 ? (
          <Stack gap='xs'>
            <Text size='sm' fw={600}>
              Your pending requests
            </Text>
            {pendingRequests.map((request) => (
              <Text key={request.id} size='sm' c='dimmed'>
                {request.doctor_name ?? 'Doctor'} — {clinicDoctorRequestStatusLabel(request.status)}
              </Text>
            ))}
          </Stack>
        ) : null}

        <Group justify='flex-end' gap='sm'>
          <Button variant='default' radius='md' onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            radius='md'
            className='doctors-mgmt-header__primary'
            disabled={!selectedDoctor}
            loading={busy}
            onClick={() => void handleSubmit()}
          >
            Submit request
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

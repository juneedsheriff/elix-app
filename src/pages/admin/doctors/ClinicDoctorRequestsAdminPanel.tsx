import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Group, Paper, Stack, Text, Textarea } from '@mantine/core';
import {
  approveClinicDoctorRequest,
  fetchPendingClinicDoctorRequestsForAdmin,
  rejectClinicDoctorRequest
} from '../../../lib/clinicDoctorRequests';
import type { ClinicDoctorRequest } from '../../../types/clinicDoctorRequest';
import { formatRequestDate } from '../requests/requestsUtils';

type ClinicDoctorRequestsAdminPanelProps = {
  onReviewed: () => void;
};

export default function ClinicDoctorRequestsAdminPanel({ onReviewed }: ClinicDoctorRequestsAdminPanelProps) {
  const [requests, setRequests] = useState<ClinicDoctorRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await fetchPendingClinicDoctorRequestsForAdmin();
    if (fetchError) {
      setError(fetchError.message);
      setRequests([]);
    } else {
      setRequests(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApprove = async (request: ClinicDoctorRequest) => {
    setBusyId(request.id);
    setError(null);
    const { error: approveError } = await approveClinicDoctorRequest(request.id);
    setBusyId(null);

    if (approveError) {
      setError(approveError.message);
      return;
    }

    setRequests((current) => current.filter((row) => row.id !== request.id));
    onReviewed();
  };

  const handleReject = async () => {
    if (!rejectId) return;
    setBusyId(rejectId);
    setError(null);
    const { error: rejectError } = await rejectClinicDoctorRequest(rejectId, rejectNote);
    setBusyId(null);

    if (rejectError) {
      setError(rejectError.message);
      return;
    }

    setRequests((current) => current.filter((row) => row.id !== rejectId));
    setRejectId(null);
    setRejectNote('');
    onReviewed();
  };

  if (loading) return null;
  if (!requests.length && !error) return null;

  return (
    <Paper radius='md' p='md' className='doctors-mgmt-panel-card' withBorder>
      <Stack gap='md'>
        <Group justify='space-between' align='flex-start'>
          <Stack gap={2}>
            <Text fw={700} size='lg'>
              Clinic doctor requests
            </Text>
            <Text size='sm' c='dimmed'>
              Clinic PSE teams requested access to platform doctors. Approve to add them to the
              clinic workspace.
            </Text>
          </Stack>
          <Badge color='orange' variant='light' size='lg' radius='md'>
            {requests.length} pending
          </Badge>
        </Group>

        {error ? (
          <Alert color='red' radius='md' onClose={() => setError(null)} withCloseButton>
            {error}
          </Alert>
        ) : null}

        {requests.map((request) => (
          <Paper key={request.id} radius='md' p='md' withBorder className='doctors-mgmt-panel-card__item'>
            <Stack gap='sm'>
              <Group justify='space-between' align='flex-start' wrap='wrap'>
                <Stack gap={2}>
                  <Text fw={600}>{request.doctor_name ?? 'Doctor'}</Text>
                  <Text size='sm' c='dimmed'>
                    {[request.doctor_specialty, request.doctor_email].filter(Boolean).join(' · ')}
                  </Text>
                  <Text size='sm' c='dimmed'>
                    Clinic: <strong>{request.clinic_name ?? 'Clinic'}</strong>
                    {' · '}
                    Requested by {request.requested_by_name ?? 'PSE'}
                    {' · '}
                    {formatRequestDate(request.created_at)}
                  </Text>
                  {request.message ? (
                    <Text size='sm' mt={4}>
                      “{request.message}”
                    </Text>
                  ) : null}
                </Stack>

                {rejectId === request.id ? (
                  <Stack gap='sm' style={{ minWidth: 280, flex: 1 }}>
                    <Textarea
                      label='Rejection note (optional)'
                      value={rejectNote}
                      onChange={(event) => setRejectNote(event.currentTarget.value)}
                      minRows={2}
                      radius='md'
                      disabled={busyId === request.id}
                    />
                    <Group gap='sm'>
                      <Button
                        variant='default'
                        radius='md'
                        disabled={busyId === request.id}
                        onClick={() => {
                          setRejectId(null);
                          setRejectNote('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        color='red'
                        radius='md'
                        loading={busyId === request.id}
                        onClick={() => void handleReject()}
                      >
                        Confirm reject
                      </Button>
                    </Group>
                  </Stack>
                ) : (
                  <Group gap='sm'>
                    <Button
                      variant='default'
                      radius='md'
                      color='red'
                      disabled={busyId === request.id}
                      onClick={() => setRejectId(request.id)}
                    >
                      Reject
                    </Button>
                    <Button
                      radius='md'
                      className='doctors-mgmt-header__primary'
                      loading={busyId === request.id}
                      onClick={() => void handleApprove(request)}
                    >
                      Approve
                    </Button>
                  </Group>
                )}
              </Group>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Paper>
  );
}

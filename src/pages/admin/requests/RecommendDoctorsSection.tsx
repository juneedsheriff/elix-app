import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  MultiSelect,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text
} from '@mantine/core';
import { IconCheck, IconShare } from '@tabler/icons-react';
import {
  fetchOpinionRequestRecommendations,
  markRecommendationsShared,
  pseAssignAndApproveDoctor,
  saveOpinionRequestRecommendations
} from '../../../lib/opinionRequests';
import { isScheduleConfirmed } from '../../../lib/consultationWizard';
import {
  consultationDurationSelectOptions,
  doctorConsultationCurrency,
  formatConsultationTierLabel,
  getTierFeeUsd
} from '../../../lib/consultationTiers';
import { formatPatientAvailability } from '../../../lib/doctorSchedule';
import type { Doctor } from '../../../types/doctor';
import type { OpinionRequest, OpinionRequestRecommendation } from '../../../types/opinionRequest';
import PatientSelectionReview from './PatientSelectionReview';
import PsePatientDoctorSummary from './PsePatientDoctorSummary';

type RecommendDoctorsSectionProps = {
  request: OpinionRequest;
  doctors: Doctor[];
  canCoordinate?: boolean;
  onUpdated: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  onPatientSelectionApproved?: () => void;
};

export default function RecommendDoctorsSection({
  request,
  doctors,
  canCoordinate = false,
  onUpdated,
  onError,
  onSuccess,
  onPatientSelectionApproved
}: RecommendDoctorsSectionProps) {
  const [recommendations, setRecommendations] = useState<OpinionRequestRecommendation[]>([]);
  const [selectedDoctorIds, setSelectedDoctorIds] = useState<string[]>([]);
  const [assignDoctorId, setAssignDoctorId] = useState<string | null>(
    () => request.selected_doctor_id ?? request.doctor_id ?? null
  );
  const [consultationDurationMinutes, setConsultationDurationMinutes] = useState<string>(
    String(request.consultation_duration_minutes ?? 30)
  );
  const [busy, setBusy] = useState(false);

  const loadRecommendations = useCallback(async () => {
    const { data, error } = await fetchOpinionRequestRecommendations(request.id);
    if (error) return;
    const list = data ?? [];
    setRecommendations(list);
    if (list.length) {
      setSelectedDoctorIds(list.map((item) => item.doctor_id));
    } else if (request.doctor_id) {
      setSelectedDoctorIds([request.doctor_id]);
    }
  }, [request.id, request.doctor_id]);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations]);

  useEffect(() => {
    const preferred =
      request.selected_doctor_id ??
      request.doctor_id ??
      (selectedDoctorIds.length === 1 ? selectedDoctorIds[0] : null);
    setAssignDoctorId((current) => current ?? preferred);
  }, [request.id, request.selected_doctor_id, request.doctor_id, selectedDoctorIds]);

  useEffect(() => {
    setAssignDoctorId(request.selected_doctor_id ?? request.doctor_id ?? null);
  }, [request.id]);

  const durationMinutes = Number(consultationDurationMinutes);
  const scheduleConfirmed = isScheduleConfirmed(request);
  const canAssignWithoutPatient = canCoordinate && !scheduleConfirmed;

  const doctorOptions = doctors.map((doctor) => {
    const fee = Number.isFinite(durationMinutes)
      ? getTierFeeUsd(doctor, durationMinutes)
      : null;
    const feeLabel =
      fee != null && Number.isFinite(durationMinutes)
        ? formatConsultationTierLabel(
            { duration_minutes: durationMinutes, fee_usd: fee },
            { currency: doctorConsultationCurrency(doctor) }
          )
        : null;
    return {
      value: doctor.id,
      label: `${doctor.full_name} · ${doctor.specialty}${feeLabel ? ` · ${feeLabel}` : ''}`
    };
  });

  const sharedStages = [
    'recommended',
    'doctor_selected',
    'availability_submitted',
    'schedule_proposed',
    'schedule_confirmed',
    'scheduled',
    'payment_pending',
    'paid',
    'completed'
  ] as const;
  const isSharedWithPatient = Boolean(
    request.consultation_stage &&
      sharedStages.includes(
        request.consultation_stage as (typeof sharedStages)[number]
      )
  );

  const patientSubmittedSelection =
    request.consultation_stage === 'availability_submitted' ||
    request.consultation_stage === 'schedule_proposed' ||
    request.consultation_stage === 'schedule_confirmed' ||
    Boolean(request.selected_doctor_id && formatPatientAvailability(request.patient_availability));

  const saveRecommendations = async (shareWithPatient: boolean) => {
    const doctorIds =
      selectedDoctorIds.length > 0
        ? selectedDoctorIds
        : request.doctor_id
          ? [request.doctor_id]
          : [];

    if (!doctorIds.length) {
      onError('Select at least one doctor to recommend to the patient.');
      return;
    }

    setBusy(true);
    const { error: saveError } = await saveOpinionRequestRecommendations(
      request.id,
      doctorIds.map((doctorId, index) => ({ doctorId, rank: index + 1 }))
    );
    if (saveError) {
      setBusy(false);
      const hint = saveError.message?.toLowerCase().includes('opinion_request_recommendations')
        ? ' Run npm run db:apply-recommendations-rls (migration 068), or npm run db:apply-consultation-workflow (migration 019) if the table is missing.'
        : '';
      onError(`${saveError.message}${hint}`);
      return;
    }

    if (shareWithPatient) {
      const { error: shareError } = await markRecommendationsShared(request.id, {
        consultationDurationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : undefined
      });
      setBusy(false);
      if (shareError) {
        onError(shareError.message);
        return;
      }
      onSuccess('Doctor recommendations shared with the patient. They can choose a doctor from their dashboard.');
    } else {
      setBusy(false);
      onSuccess('Recommendations saved. Click “Share with patient” when ready.');
    }

    void loadRecommendations();
    onUpdated();
  };

  const assignAndApproveDoctor = async () => {
    if (!assignDoctorId) {
      onError('Select a doctor to assign.');
      return;
    }

    setBusy(true);
    const recommendation = recommendations.find((item) => item.doctor_id === assignDoctorId);
    const { error } = await pseAssignAndApproveDoctor(request.id, assignDoctorId, {
      consultationDurationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : undefined,
      recommendation: recommendation
        ? {
            doctor_id: recommendation.doctor_id,
            doctor_name: recommendation.doctor_name,
            doctor_consultation_tiers: recommendation.doctor_consultation_tiers,
            doctor_consultation_currency: recommendation.doctor_consultation_currency
          }
        : undefined
    });
    setBusy(false);
    if (error) {
      onError(error.message);
      return;
    }

    // Keep the assigned doctor on the recommendation list for history.
    if (!selectedDoctorIds.includes(assignDoctorId)) {
      await saveOpinionRequestRecommendations(request.id, [
        ...selectedDoctorIds.map((doctorId, index) => ({ doctorId, rank: index + 1 })),
        { doctorId: assignDoctorId, rank: selectedDoctorIds.length + 1 }
      ]);
    }

    onSuccess('Doctor assigned and approved. Continue to Step 4 — Send payment link.');
    void loadRecommendations();
    onUpdated();
    onPatientSelectionApproved?.();
  };

  return (
    <Stack gap='md' className='doctors-mgmt-recommend'>
      <PsePatientDoctorSummary
        request={request}
        recommendations={recommendations}
        canCoordinate={canCoordinate}
        onUpdated={onUpdated}
        onError={onError}
        onSuccess={onSuccess}
        onApproved={onPatientSelectionApproved}
      />

      {patientSubmittedSelection ? (
        <PatientSelectionReview
          request={request}
          canCoordinate={canCoordinate}
          onUpdated={onUpdated}
          onError={onError}
          onSuccess={onSuccess}
        />
      ) : null}

      {canCoordinate ? (
        <Paper
          radius='md'
          p='md'
          withBorder
          className='doctors-mgmt-detail-block doctors-mgmt-recommend__actions'
        >
          <Group justify='space-between' align='flex-start' wrap='wrap' gap='sm' mb='sm'>
            <Stack gap={4}>
              <Text size='sm' fw={700}>
                Manage recommendation list
              </Text>
              <Text size='xs' c='dimmed'>
                Add or update doctors, then share the list with the patient — or assign a doctor
                directly without waiting for patient approval.
              </Text>
            </Stack>
            <Badge
              variant='light'
              color={isSharedWithPatient ? 'green' : 'orange'}
              radius='xl'
            >
              {isSharedWithPatient ? 'Shared with patient' : 'Not shared yet'}
            </Badge>
          </Group>

          <Stack gap={4} mb='sm'>
            <Text size='sm' fw={600}>
              Consultation duration for this case
            </Text>
            <Text size='xs' c='dimmed'>
              Patients will see each doctor&apos;s fee for this session length.
            </Text>
            <SegmentedControl
              value={consultationDurationMinutes}
              onChange={setConsultationDurationMinutes}
              data={consultationDurationSelectOptions()}
              disabled={busy}
            />
          </Stack>

          <MultiSelect
            label='Doctors to recommend'
            placeholder='Search and select doctors…'
            data={doctorOptions}
            value={selectedDoctorIds}
            onChange={setSelectedDoctorIds}
            searchable
            clearable
            disabled={busy || !doctors.length}
            mb='sm'
          />

          {!doctors.length ? (
            <Alert color='orange' radius='md' mb='sm' title='No doctors available'>
              Add doctors under ElixClinix → Doctors before you can build a recommendation list.
            </Alert>
          ) : null}

          <Group gap='sm' mb={canAssignWithoutPatient ? 'md' : undefined}>
            <Button
              variant='default'
              radius='md'
              loading={busy}
              onClick={() => void saveRecommendations(false)}
            >
              Save list
            </Button>
            <Button
              radius='md'
              className='doctors-mgmt-header__primary'
              leftSection={<IconShare size={16} />}
              loading={busy}
              onClick={() => void saveRecommendations(true)}
            >
              Share with patient
            </Button>
          </Group>

          {canAssignWithoutPatient ? (
            <Stack gap='sm' pt='sm' style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
              <Stack gap={2}>
                <Text size='sm' fw={600}>
                  Assign doctor without patient approval
                </Text>
                <Text size='xs' c='dimmed'>
                  Select the consulting doctor and approve immediately — the patient does not need to
                  choose or confirm first. You can then send the payment link.
                </Text>
              </Stack>
              <Select
                label='Doctor to assign'
                placeholder='Select doctor…'
                data={doctorOptions}
                value={assignDoctorId}
                onChange={setAssignDoctorId}
                searchable
                clearable
                disabled={busy || !doctors.length}
              />
              <Group>
                <Button
                  radius='md'
                  color='teal'
                  leftSection={<IconCheck size={16} />}
                  loading={busy}
                  disabled={!assignDoctorId || !doctors.length}
                  onClick={() => void assignAndApproveDoctor()}
                >
                  Assign &amp; approve doctor
                </Button>
              </Group>
            </Stack>
          ) : null}
        </Paper>
      ) : null}
    </Stack>
  );
}

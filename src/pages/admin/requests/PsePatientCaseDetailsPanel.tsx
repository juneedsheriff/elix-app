import { useEffect, useState } from 'react';
import { Badge, Group, Stack, Text } from '@mantine/core';
import PatientCaseDetailsEditor from '../../../components/OpinionRequests/PatientCaseDetailsEditor';
import PatientCaseDetailsReadOnlyView from '../../../components/OpinionRequests/PatientCaseDetailsReadOnlyView';
import { fetchDoctorSpecialties } from '../../../lib/doctors';
import { isClinicPatientServiceExecutive } from '../../../lib/staffPermissions';
import type { OpinionRequest } from '../../../types/opinionRequest';
import { useElixHealthStaff } from '../ElixHealthStaffContext';

type Props = {
  request: OpinionRequest;
  busy: boolean;
  canCoordinate?: boolean;
  onMarkReviewed: () => void;
  onUpdated: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

export default function PsePatientCaseDetailsPanel({
  request,
  busy,
  canCoordinate = true,
  onMarkReviewed,
  onUpdated,
  onError,
  onSuccess
}: Props) {
  const { staff } = useElixHealthStaff();
  const isClinicPse = isClinicPatientServiceExecutive(staff);
  const showClinicOnlyCaseSections = !isClinicPse;
  const specialtyMode =
    isClinicPse && request.doctor_specialty?.trim() ? 'from_doctor' : 'patient_select';
  const [specialties, setSpecialties] = useState<string[]>([]);

  const caseDetailsSyncKey = JSON.stringify({
    patientCaseDetails: request.patient_case_details ?? null,
    message: request.message ?? '',
    requestedSpecialty: request.requested_specialty ?? ''
  });

  useEffect(() => {
    let cancelled = false;
    void fetchDoctorSpecialties().then(({ data }) => {
      if (!cancelled) setSpecialties(data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Stack gap='md' className='request-workflow-step pse-case-details-panel'>
      <Group justify='space-between' wrap='wrap' gap='xs'>
        <Stack gap={2}>
          <Text size='sm' fw={600}>
            Step 2 — Patient Case Details
          </Text>
          <Text size='xs' c='dimmed'>
            Review and update the patient&apos;s submitted case information. Save changes before
            marking as reviewed.
          </Text>
        </Stack>
        {request.case_details_reviewed_at ? (
          <Badge color='teal' variant='light' size='sm'>
            Reviewed {new Date(request.case_details_reviewed_at).toLocaleString()}
          </Badge>
        ) : null}
      </Group>

      {canCoordinate ? (
        <PatientCaseDetailsEditor
          key={caseDetailsSyncKey}
          request={request}
          specialties={specialties}
          specialtyMode={specialtyMode}
          doctorSpecialty={request.doctor_specialty}
          actorRole='pse'
          showCurrentHealthcareProvider={showClinicOnlyCaseSections}
          showConsultationQuestions={showClinicOnlyCaseSections}
          canMarkReviewed
          markReviewedBusy={busy}
          onMarkReviewed={onMarkReviewed}
          onSaved={() => {
            onUpdated();
          }}
          onError={onError}
          onSuccess={onSuccess}
        />
      ) : (
        <PatientCaseDetailsReadOnlyView
          request={request}
          showCurrentHealthcareProvider={showClinicOnlyCaseSections}
          showConsultationQuestions={showClinicOnlyCaseSections}
        />
      )}
    </Stack>
  );
}

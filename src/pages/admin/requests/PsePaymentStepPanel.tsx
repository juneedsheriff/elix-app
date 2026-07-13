import {
  Alert,
  Anchor,
  Badge,
  Button,
  Grid,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  TextInput
} from '@mantine/core';
import { IconExternalLink, IconReceipt } from '@tabler/icons-react';
import {
  CONSULTATION_CURRENCY_OPTIONS,
  formatConsultationFee,
  normalizeConsultationCurrency,
  type ConsultationCurrency
} from '../../../lib/consultationCurrency';
import {
  canPseSendPaymentLink,
  isScheduleConfirmed
} from '../../../lib/consultationWizard';
import { formatDurationMinutesLabel } from '../../../lib/consultationTiers';
import ConsultationInvoicePdfView from '../../../components/ConsultationWorkflow/ConsultationInvoicePdfView';
import type { OpinionRequest } from '../../../types/opinionRequest';
import PaymentProofReview from './PaymentProofReview';

type PsePaymentStepPanelProps = {
  request: OpinionRequest;
  paymentLink: string;
  paymentLinkPlaceholder?: string;
  paymentAmount: number | null;
  paymentCurrency: ConsultationCurrency;
  paymentReference: string;
  busy: boolean;
  readOnly?: boolean;
  onPaymentLinkChange: (value: string) => void;
  onPaymentCurrencyChange: (value: ConsultationCurrency) => void;
  onPaymentReferenceChange: (value: string) => void;
  onSendInvoiceAndPaymentLink: () => void;
  onMarkPending: () => void;
  onConfirmPayment: () => void;
  onReleaseToDoctor: () => void;
};

function parseAmountFromPaymentLink(link: string): number | null {
  const trimmed = link.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const raw = url.searchParams.get('amount');
    if (raw != null && raw.trim()) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  } catch {
    // fall through
  }
  const match = trimmed.match(/[?&]amount=([^&]+)/i) ?? trimmed.match(/amount=([^&\s]+)/i);
  if (!match?.[1]) return null;
  const parsed = Number(decodeURIComponent(match[1]));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export default function PsePaymentStepPanel({
  request,
  paymentLink,
  paymentLinkPlaceholder = 'https://elixclinix.com/pay.html?amount=',
  paymentAmount,
  paymentCurrency,
  paymentReference,
  busy,
  readOnly = false,
  onPaymentLinkChange,
  onPaymentCurrencyChange,
  onPaymentReferenceChange,
  onSendInvoiceAndPaymentLink,
  onMarkPending,
  onConfirmPayment,
  onReleaseToDoctor
}: PsePaymentStepPanelProps) {
  const canSend = canPseSendPaymentLink(request);
  const linkShared = Boolean(request.payment_link?.trim());
  const invoiceReady = Boolean(request.invoice_pdf_storage_path?.trim());
  const linkAmount = parseAmountFromPaymentLink(paymentLink);
  const effectiveAmount =
    linkAmount ??
    (request.invoice_total != null && Number.isFinite(Number(request.invoice_total))
      ? Number(request.invoice_total)
      : null) ??
    paymentAmount;
  const canSubmitToPatient =
    canSend && effectiveAmount != null && Boolean(paymentLink.trim());
  const formattedAmount =
    effectiveAmount != null
      ? formatConsultationFee(effectiveAmount, normalizeConsultationCurrency(paymentCurrency))
      : null;
  const statusLabel =
    request.payment_status === 'paid'
      ? 'Paid'
      : request.payment_proof_submitted_at
        ? 'Proof received'
        : linkShared
          ? 'Awaiting payment'
          : 'Not sent';

  return (
    <Stack gap='md' className='pse-payment-panel'>
      {!canSend ? (
        <Alert color='orange' radius='md' title='Schedule not confirmed'>
          Confirm availability with the patient on Recommend doctors and wait for them to confirm
          the schedule.
        </Alert>
      ) : isScheduleConfirmed(request) ? (
        <Alert color='green' radius='md' variant='light'>
          Patient confirmed the schedule
          {request.schedule_confirmed_at
            ? ` on ${new Date(request.schedule_confirmed_at).toLocaleString()}`
            : ''}
          . Enter the payment link below, then send the invoice and link together.
        </Alert>
      ) : (
        <Alert color='teal' radius='md' variant='light'>
          Patient submitted their doctor and preferred time. Enter the payment link and send the
          invoice together.
        </Alert>
      )}

      {request.consultation_duration_minutes && formattedAmount ? (
        <Alert color='blue' radius='md' variant='light' title='Doctor consultation fee'>
          {formatDurationMinutesLabel(request.consultation_duration_minutes)} · {formattedAmount} (auto-filled
          from the selected doctor&apos;s quote).
        </Alert>
      ) : formattedAmount ? (
        <Alert color='blue' radius='md' variant='light' title='Doctor consultation fee'>
          {formattedAmount} (auto-filled from the selected doctor&apos;s quote).
        </Alert>
      ) : request.consultation_duration_minutes ? (
        <Alert color='orange' radius='md' variant='light' title='Consultation fee missing'>
          Could not resolve the fee for a{' '}
          {formatDurationMinutesLabel(Number(request.consultation_duration_minutes))} session. Check
          that the selected doctor has pricing for this duration.
        </Alert>
      ) : (
        <Alert color='orange' radius='md' variant='light' title='Consultation fee missing'>
          Confirm the patient selected a doctor and session length before sending a payment link.
        </Alert>
      )}

      <Paper radius='md' p='lg' withBorder className='pse-payment-panel__form'>
        <Group justify='space-between' align='center' mb='md'>
          <Text fw={700} size='sm'>
            Payment details
          </Text>
          <Badge variant='light' color={request.payment_status === 'paid' ? 'green' : 'cyan'} radius='xl'>
            {statusLabel}
          </Badge>
        </Group>

        <Grid gutter='md'>
          <Grid.Col span={{ base: 12, sm: 8 }}>
            <TextInput
              label='Payment link (external)'
              description='Pre-filled from consultation amount. You can edit if needed.'
              placeholder={paymentLinkPlaceholder}
              value={paymentLink}
              readOnly={readOnly}
              onChange={(e) => onPaymentLinkChange(e.currentTarget.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Stack gap={4}>
              <Text size='sm' fw={500}>
                Amount
              </Text>
              <Text size='sm' fw={600}>
                {formattedAmount ?? '—'}
              </Text>
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Select
              label='Currency'
              description='Invoice & payment currency'
              data={CONSULTATION_CURRENCY_OPTIONS.map((option) => ({
                value: option.value,
                label: option.value
              }))}
              value={normalizeConsultationCurrency(paymentCurrency)}
              disabled={readOnly}
              allowDeselect={false}
              onChange={(value) => {
                if (value) onPaymentCurrencyChange(normalizeConsultationCurrency(value));
              }}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 8 }}>
            <TextInput
              label='Payment reference'
              placeholder='Receipt / transaction ID (after patient pays)'
              value={paymentReference}
              readOnly={readOnly}
              onChange={(e) => onPaymentReferenceChange(e.currentTarget.value)}
            />
          </Grid.Col>
        </Grid>

        {!readOnly ? (
          <Group gap='sm' mt='lg' wrap='wrap'>
            <Button
              className='doctors-mgmt-header__primary'
              radius='md'
              leftSection={<IconReceipt size={16} />}
              loading={busy}
              disabled={!canSubmitToPatient}
              onClick={onSendInvoiceAndPaymentLink}
            >
              {linkShared ? 'Regenerate invoice & update link' : 'Generate invoice & send to patient'}
            </Button>
            <Button
              variant='default'
              radius='md'
              loading={busy}
              disabled={!canSend || effectiveAmount == null}
              onClick={onMarkPending}
            >
              Mark pending (no link)
            </Button>
            <Button variant='light' color='cyan' radius='md' loading={busy} onClick={onConfirmPayment}>
              Confirm payment received
            </Button>
          </Group>
        ) : null}
      </Paper>

      {invoiceReady ? (
        <Paper radius='md' p='lg' withBorder className='pse-payment-panel__invoice'>
          <Group justify='space-between' align='center' mb='md' wrap='wrap' gap='sm'>
            <Stack gap={2}>
              <Text fw={700} size='sm'>
                Consultation invoice
              </Text>
              <Text size='xs' c='dimmed'>
                Shared with the patient on their Payment step.
              </Text>
            </Stack>
            <Badge variant='light' color='green' radius='xl'>
              Sent to patient
            </Badge>
          </Group>
          <ConsultationInvoicePdfView request={request} variant='pse' />
        </Paper>
      ) : null}

      {linkShared ? (
        <Paper radius='md' p='md' withBorder className='pse-payment-panel__shared'>
          <Group justify='space-between' align='flex-start' wrap='wrap' gap='xs' mb='xs'>
            <Text size='sm' fw={600}>
              Live on patient dashboard
            </Text>
            <Badge size='sm' variant='outline' color='gray'>
              {request.payment_amount != null
                ? `${request.payment_amount} ${request.payment_currency ?? 'USD'}`
                : effectiveAmount != null
                  ? `${effectiveAmount} ${paymentCurrency}`
                  : 'Amount missing'}
            </Badge>
          </Group>
          <Anchor
            href={request.payment_link!}
            target='_blank'
            rel='noreferrer'
            size='sm'
            className='pse-payment-panel__shared-link'
          >
            {request.payment_link}
            <IconExternalLink size={14} style={{ marginLeft: 4 }} aria-hidden />
          </Anchor>
        </Paper>
      ) : null}

      <PaymentProofReview request={request} />

      {request.payment_status === 'paid' && !readOnly ? (
        <Button variant='light' color='cyan' radius='md' loading={busy} onClick={onReleaseToDoctor}>
          Release to doctor
        </Button>
      ) : null}
    </Stack>
  );
}

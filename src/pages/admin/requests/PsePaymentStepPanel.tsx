import {
  Alert,
  Anchor,
  Badge,
  Button,
  Grid,
  Group,
  NumberInput,
  Paper,
  Stack,
  Text,
  TextInput
} from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import {
  canPseSendPaymentLink,
  isScheduleConfirmed
} from '../../../lib/consultationWizard';
import type { OpinionRequest } from '../../../types/opinionRequest';
import PaymentProofReview from './PaymentProofReview';

type PsePaymentStepPanelProps = {
  request: OpinionRequest;
  paymentLink: string;
  paymentAmount: number | string;
  paymentCurrency: string;
  paymentReference: string;
  busy: boolean;
  onPaymentLinkChange: (value: string) => void;
  onPaymentAmountChange: (value: number | string) => void;
  onPaymentCurrencyChange: (value: string) => void;
  onPaymentReferenceChange: (value: string) => void;
  onSendPaymentLink: () => void;
  onMarkPending: () => void;
  onConfirmPayment: () => void;
  onReleaseToDoctor: () => void;
};

export default function PsePaymentStepPanel({
  request,
  paymentLink,
  paymentAmount,
  paymentCurrency,
  paymentReference,
  busy,
  onPaymentLinkChange,
  onPaymentAmountChange,
  onPaymentCurrencyChange,
  onPaymentReferenceChange,
  onSendPaymentLink,
  onMarkPending,
  onConfirmPayment,
  onReleaseToDoctor
}: PsePaymentStepPanelProps) {
  const canSend = canPseSendPaymentLink(request);
  const linkShared = Boolean(request.payment_link?.trim());
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
          . You can send or update the payment link below.
        </Alert>
      ) : (
        <Alert color='teal' radius='md' variant='light'>
          Patient submitted their doctor and preferred time. You may send the payment link now.
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
              placeholder='https://…'
              value={paymentLink}
              onChange={(e) => onPaymentLinkChange(e.currentTarget.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <NumberInput
              label='Amount'
              value={paymentAmount}
              onChange={onPaymentAmountChange}
              min={0}
              decimalScale={2}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <TextInput
              label='Currency'
              value={paymentCurrency}
              onChange={(e) => onPaymentCurrencyChange(e.currentTarget.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 8 }}>
            <TextInput
              label='Payment reference'
              placeholder='Receipt / transaction ID (after patient pays)'
              value={paymentReference}
              onChange={(e) => onPaymentReferenceChange(e.currentTarget.value)}
            />
          </Grid.Col>
        </Grid>

        <Group gap='sm' mt='lg' wrap='wrap'>
          <Button
            className='doctors-mgmt-header__primary'
            radius='md'
            loading={busy}
            disabled={!canSend}
            onClick={onSendPaymentLink}
          >
            {linkShared ? 'Update payment link' : 'Send to patient'}
          </Button>
          <Button variant='default' radius='md' loading={busy} disabled={!canSend} onClick={onMarkPending}>
            Mark pending (no link)
          </Button>
          <Button variant='light' color='cyan' radius='md' loading={busy} onClick={onConfirmPayment}>
            Confirm payment received
          </Button>
        </Group>
      </Paper>

      {linkShared ? (
        <Paper radius='md' p='md' withBorder className='pse-payment-panel__shared'>
          <Group justify='space-between' align='flex-start' wrap='wrap' gap='xs' mb='xs'>
            <Text size='sm' fw={600}>
              Live on patient dashboard
            </Text>
            <Badge size='sm' variant='outline' color='gray'>
              {request.payment_amount != null
                ? `${request.payment_amount} ${request.payment_currency ?? 'USD'}`
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

      {request.payment_status === 'paid' ? (
        <Button variant='light' color='cyan' radius='md' loading={busy} onClick={onReleaseToDoctor}>
          Release to doctor
        </Button>
      ) : null}
    </Stack>
  );
}

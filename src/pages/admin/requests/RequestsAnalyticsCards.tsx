import { memo } from 'react';
import { Group, Paper, SimpleGrid, Text, ThemeIcon } from '@mantine/core';
import {
  IconClipboardList,
  IconClock,
  IconStethoscope,
  IconCircleCheck,
  IconCalendarUser
} from '@tabler/icons-react';
import type { RequestAnalytics } from './requestsUtils';

type RequestsAnalyticsCardsProps = {
  analytics: RequestAnalytics;
  pendingLabel: string;
  showPatientSelections?: boolean;
  loading?: boolean;
};

const CARDS = [
  {
    key: 'total',
    label: 'Total Requests',
    icon: IconClipboardList,
    gradient: 'doctors-mgmt-stat--total',
    value: (a: RequestAnalytics) => a.total.toLocaleString()
  },
  {
    key: 'pending',
    label: 'pendingLabel',
    icon: IconClock,
    gradient: 'doctors-mgmt-stat--disabled',
    value: (a: RequestAnalytics) => a.pendingQueue.toLocaleString()
  },
  {
    key: 'withDoctor',
    label: 'With Doctor',
    icon: IconStethoscope,
    gradient: 'doctors-mgmt-stat--specialties',
    value: (a: RequestAnalytics) => a.withDoctor.toLocaleString()
  },
  {
    key: 'closed',
    label: 'Closed',
    icon: IconCircleCheck,
    gradient: 'doctors-mgmt-stat--active',
    value: (a: RequestAnalytics) => a.closed.toLocaleString()
  }
] as const;

function RequestsAnalyticsCards({
  analytics,
  pendingLabel,
  showPatientSelections = false,
  loading
}: RequestsAnalyticsCardsProps) {
  const cards = showPatientSelections
    ? CARDS.map((card) =>
        card.key === 'pending'
          ? {
              ...card,
              label: 'Patient selections',
              icon: IconCalendarUser,
              value: (a: RequestAnalytics) => a.patientSelectionsToReview.toLocaleString()
            }
          : card
      )
    : CARDS;

  return (
    <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} className='doctors-mgmt-stats'>
      {cards.map(({ key, label, icon: Icon, gradient, value }) => (
        <Paper
          key={key}
          className={`doctors-mgmt-stat ${gradient}`}
          radius='xl'
          data-loading={loading || undefined}
        >
          <Group justify='space-between' align='flex-start' wrap='nowrap' gap='sm'>
            <div>
              <Text size='xs' tt='uppercase' fw={600} className='doctors-mgmt-stat__label'>
                {label === 'pendingLabel' ? pendingLabel : label}
              </Text>
              <Text className='doctors-mgmt-stat__value' fw={700}>
                {value(analytics)}
              </Text>
            </div>
            <ThemeIcon size={31} radius='xl' variant='white' className='doctors-mgmt-stat__icon'>
              <Icon size={15} stroke={1.6} />
            </ThemeIcon>
          </Group>
        </Paper>
      ))}
    </SimpleGrid>
  );
}

export default memo(RequestsAnalyticsCards);

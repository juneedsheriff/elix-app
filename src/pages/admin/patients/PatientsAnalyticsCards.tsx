import { memo } from 'react';
import { Group, Paper, SimpleGrid, Text, ThemeIcon } from '@mantine/core';
import {
  IconBan,
  IconMapPin,
  IconShieldCheck,
  IconUsers
} from '@tabler/icons-react';
import type { PatientAnalytics } from './patientsUtils';

type PatientsAnalyticsCardsProps = {
  analytics: PatientAnalytics;
  loading?: boolean;
};

const CARDS = [
  {
    key: 'total',
    label: 'Total Patients',
    icon: IconUsers,
    gradient: 'doctors-mgmt-stat--total',
    value: (a: PatientAnalytics) => a.total.toLocaleString()
  },
  {
    key: 'active',
    label: 'Active Logins',
    icon: IconShieldCheck,
    gradient: 'doctors-mgmt-stat--active',
    value: (a: PatientAnalytics) => a.activeLogins.toLocaleString()
  },
  {
    key: 'disabled',
    label: 'Disabled Accounts',
    icon: IconBan,
    gradient: 'doctors-mgmt-stat--disabled',
    value: (a: PatientAnalytics) => a.disabledAccounts.toLocaleString()
  },
  {
    key: 'countries',
    label: 'Countries',
    icon: IconMapPin,
    gradient: 'doctors-mgmt-stat--specialties',
    value: (a: PatientAnalytics) => a.countriesCount.toLocaleString()
  }
] as const;

function PatientsAnalyticsCards({ analytics, loading }: PatientsAnalyticsCardsProps) {
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} className='doctors-mgmt-stats'>
      {CARDS.map(({ key, label, icon: Icon, gradient, value }) => (
        <Paper
          key={key}
          className={`doctors-mgmt-stat ${gradient}`}
          radius='xl'
          data-loading={loading || undefined}
        >
          <Group justify='space-between' align='flex-start' wrap='nowrap' gap='sm'>
            <div>
              <Text size='xs' tt='uppercase' fw={600} className='doctors-mgmt-stat__label'>
                {label}
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

export default memo(PatientsAnalyticsCards);

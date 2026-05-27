import { memo } from 'react';
import { Group, Paper, SimpleGrid, Text, ThemeIcon } from '@mantine/core';
import {
  IconBan,
  IconCategory,
  IconShieldCheck,
  IconStethoscope
} from '@tabler/icons-react';
import type { DoctorAnalytics } from './doctorsUtils';

type DoctorsAnalyticsCardsProps = {
  analytics: DoctorAnalytics;
  loading?: boolean;
};

const CARDS = [
  {
    key: 'total',
    label: 'Total Doctors',
    icon: IconStethoscope,
    gradient: 'doctors-mgmt-stat--total',
    value: (a: DoctorAnalytics) => a.total.toLocaleString()
  },
  {
    key: 'active',
    label: 'Active Logins',
    icon: IconShieldCheck,
    gradient: 'doctors-mgmt-stat--active',
    value: (a: DoctorAnalytics) => a.activeLogins.toLocaleString()
  },
  {
    key: 'disabled',
    label: 'Disabled Accounts',
    icon: IconBan,
    gradient: 'doctors-mgmt-stat--disabled',
    value: (a: DoctorAnalytics) => a.disabledAccounts.toLocaleString()
  },
  {
    key: 'specialties',
    label: 'Specialties',
    icon: IconCategory,
    gradient: 'doctors-mgmt-stat--specialties',
    value: (a: DoctorAnalytics) => a.specialtiesCount.toLocaleString()
  }
] as const;

function DoctorsAnalyticsCards({ analytics, loading }: DoctorsAnalyticsCardsProps) {
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

export default memo(DoctorsAnalyticsCards);

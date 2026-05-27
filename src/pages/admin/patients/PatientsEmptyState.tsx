import { Button, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconFilterOff, IconUsers } from '@tabler/icons-react';

type PatientsEmptyStateProps = {
  hasFilters: boolean;
  onClearFilters: () => void;
};

export default function PatientsEmptyState({ hasFilters, onClearFilters }: PatientsEmptyStateProps) {
  return (
    <Stack className='doctors-mgmt-empty' align='center' justify='center' gap='md' py={64}>
      <ThemeIcon size={72} radius='xl' variant='light' color='cyan' className='doctors-mgmt-empty__icon'>
        {hasFilters ? <IconFilterOff size={36} stroke={1.5} /> : <IconUsers size={36} stroke={1.5} />}
      </ThemeIcon>
      <Stack gap={6} align='center' maw={420}>
        <Title order={4} fw={600}>
          {hasFilters ? 'No patients match your filters' : 'No patients registered yet'}
        </Title>
        <Text size='sm' c='dimmed' ta='center'>
          {hasFilters
            ? 'Try adjusting search terms or quick filters to find the patient you need.'
            : 'When patients register, they will appear here with profile and login details.'}
        </Text>
      </Stack>
      {hasFilters ? (
        <Button variant='light' color='cyan' radius='md' onClick={onClearFilters} leftSection={<IconFilterOff size={16} />}>
          Clear filters
        </Button>
      ) : null}
    </Stack>
  );
}

import { Button, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconFilterOff, IconStethoscope } from '@tabler/icons-react';

type DoctorsEmptyStateProps = {
  hasFilters: boolean;
  onClearFilters: () => void;
};

export default function DoctorsEmptyState({ hasFilters, onClearFilters }: DoctorsEmptyStateProps) {
  return (
    <Stack className='doctors-mgmt-empty' align='center' justify='center' gap='md' py={64}>
      <ThemeIcon size={72} radius='xl' variant='light' color='cyan' className='doctors-mgmt-empty__icon'>
        {hasFilters ? <IconFilterOff size={36} stroke={1.5} /> : <IconStethoscope size={36} stroke={1.5} />}
      </ThemeIcon>
      <Stack gap={6} align='center' maw={420}>
        <Title order={4} fw={600}>
          {hasFilters ? 'No doctors match your filters' : 'No doctors registered yet'}
        </Title>
        <Text size='sm' c='dimmed' ta='center'>
          {hasFilters
            ? 'Try adjusting search terms or quick filters to find the provider you need.'
            : 'When doctors are added to the directory, they will appear here with full profile and login details.'}
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

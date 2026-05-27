import { Button, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconClipboardList, IconFilterOff } from '@tabler/icons-react';

type RequestsEmptyStateProps = {
  hasFilters: boolean;
  isPendingQueue: boolean;
  isAdmin: boolean;
  onClearFilters: () => void;
};

export default function RequestsEmptyState({
  hasFilters,
  isPendingQueue,
  isAdmin,
  onClearFilters
}: RequestsEmptyStateProps) {
  const pendingMessage = isAdmin
    ? 'No requests waiting for assignment.'
    : 'No assigned requests waiting for coordination.';

  const emptyMessage = 'No opinion requests yet.';

  return (
    <Stack className='doctors-mgmt-empty' align='center' justify='center' gap='md' py={64}>
      <ThemeIcon size={72} radius='xl' variant='light' color='cyan' className='doctors-mgmt-empty__icon'>
        {hasFilters ? <IconFilterOff size={36} stroke={1.5} /> : <IconClipboardList size={36} stroke={1.5} />}
      </ThemeIcon>
      <Stack gap={6} align='center' maw={420}>
        <Title order={4} fw={600}>
          {hasFilters
            ? 'No requests match your filters'
            : isPendingQueue
              ? 'Queue is clear'
              : 'No requests yet'}
        </Title>
        <Text size='sm' c='dimmed' ta='center'>
          {hasFilters
            ? 'Try adjusting search terms or filters to find the request you need.'
            : isPendingQueue
              ? pendingMessage
              : emptyMessage}
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

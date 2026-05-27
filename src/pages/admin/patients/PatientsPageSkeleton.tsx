import { Box, Group, Skeleton, SimpleGrid, Stack } from '@mantine/core';

export default function PatientsPageSkeleton() {
  return (
    <Stack className='doctors-mgmt doctors-mgmt--loading' gap='lg'>
      <Group justify='space-between' align='flex-end' wrap='wrap'>
        <Stack gap={8}>
          <Skeleton height={32} width={180} radius='md' />
          <Skeleton height={14} width={120} radius='sm' />
        </Stack>
        <Group gap='sm'>
          <Skeleton height={40} width={120} radius='md' />
          <Skeleton height={40} width={100} radius='md' />
          <Skeleton height={40} width={100} radius='md' />
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} className='doctors-mgmt-stats'>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} height={76} radius='xl' />
        ))}
      </SimpleGrid>

      <Box className='doctors-mgmt-table-shell'>
        <Group justify='space-between' p='md' wrap='wrap'>
          <Skeleton height={40} width={280} radius='md' />
          <Group gap='sm'>
            <Skeleton height={36} width={140} radius='md' />
            <Skeleton height={36} width={140} radius='md' />
            <Skeleton height={36} width={120} radius='md' />
          </Group>
        </Group>
        <Stack gap='sm' p='md' pt={0}>
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} height={52} radius='md' />
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}

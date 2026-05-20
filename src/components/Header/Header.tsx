import { Container, Title } from '@mantine/core';
import { getDashboardHeaderTitle } from '../../lib/dashboardTitle';

type HeaderProps = {
  screenId?: string;
  fallbackTitle?: string;
};

const Header = ({ screenId, fallbackTitle = 'Dashboard' }: HeaderProps) => {
  const title = getDashboardHeaderTitle(screenId, fallbackTitle);

  return (
    <header>
      <Container size='lg'>
        <Title order={1}>{title}</Title>
      </Container>
    </header>
  );
};

export default Header;

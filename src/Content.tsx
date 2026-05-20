// Content.tsx
import React, { ReactNode } from 'react';
import { Container } from '@mantine/core';
import Header from './components/Header/Header';
interface ContentProps {
  children: ReactNode;
  screenId?: string;
}

const Content: React.FC<ContentProps> = ({ children, screenId }) => {
  return (
    <main>
      <Header screenId={screenId} />

      <Container size="lg">
        {children}
      </Container>
    </main>
  );
};

export default Content;

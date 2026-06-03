import { MantineProvider, createTheme, localStorageColorSchemeManager } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import type { ReactNode } from 'react';
import 'dayjs/locale/en';

const colorSchemeManager = localStorageColorSchemeManager({
  key: 'elix-health-color-scheme'
});

const elixHealthTheme = createTheme({
  primaryColor: 'cyan',
  fontFamily: "'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
  headings: {
    fontFamily: "'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif"
  },
  colors: {
    brand: [
      '#e6f7fa',
      '#c5edf3',
      '#9fdfe9',
      '#6fcfdf',
      '#3bbfd4',
      '#09abc0',
      '#089aab',
      '#078596',
      '#066f7d',
      '#055a66'
    ]
  },
  defaultRadius: 'md',
  components: {
    Paper: {
      defaultProps: {
        shadow: 'xs'
      }
    },
    Button: {
      defaultProps: {
        radius: 'md'
      }
    }
  }
});

type ElixHealthMantineProviderProps = {
  children: ReactNode;
};

export default function ElixHealthMantineProvider({ children }: ElixHealthMantineProviderProps) {
  return (
    <MantineProvider
      theme={elixHealthTheme}
      colorSchemeManager={colorSchemeManager}
      defaultColorScheme='light'
    >
      <DatesProvider settings={{ locale: 'en', firstDayOfWeek: 0, weekendDays: [0, 6] }}>
        {children}
      </DatesProvider>
    </MantineProvider>
  );
}

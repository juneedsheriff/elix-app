import { Tabs } from '@mantine/core';

export type WorkspaceTabItem = {
  value: string;
  label: string;
};

type WorkspaceTabsProps = {
  tabs: WorkspaceTabItem[];
  value: string;
  onChange: (value: string) => void;
};

export default function WorkspaceTabs({ tabs, value, onChange }: WorkspaceTabsProps) {
  if (!tabs.length) return null;

  return (
    <div className='elixhealth-workspace-tabs'>
      <Tabs
        value={value}
        onChange={(next) => next && onChange(next)}
        variant='pills'
        radius='md'
        classNames={{
          root: 'elixhealth-workspace-tabs__root',
          list: 'elixhealth-workspace-tabs__list',
          tab: 'elixhealth-workspace-tabs__tab'
        }}
      >
        <Tabs.List>
          {tabs.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
    </div>
  );
}

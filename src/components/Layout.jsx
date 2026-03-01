import { useState } from 'react';
import { UnderlineNav, Heading } from '@primer/react';

const TABS = [
  { key: 'settings', label: 'Settings' },
  { key: 'datasets', label: 'Datasets' },
  { key: 'experiments', label: 'Experiments' },
  { key: 'results', label: 'Results' },
  { key: 'logs', label: 'Logs' },
];

function Layout({ panels, machineState }) {
  const [activeTab, setActiveTab] = useState('settings');
  const isRunning = machineState && machineState.matches('executing');

  return (
    <div>
      <Heading as="h1" sx={{ mb: 3 }}>LLM Explorer</Heading>
      <UnderlineNav aria-label="Main navigation">
        {TABS.map(tab => (
          <UnderlineNav.Item
            key={tab.key}
            aria-current={activeTab === tab.key ? 'page' : undefined}
            onSelect={(e) => {
              e.preventDefault();
              setActiveTab(tab.key);
            }}
          >
            {tab.label}
            {tab.key === 'experiments' && isRunning && ' ⏳'}
          </UnderlineNav.Item>
        ))}
      </UnderlineNav>
      <div style={{ marginTop: '16px' }}>
        {Object.entries(panels).map(([key, panel]) => (
          <div key={key} style={{ display: activeTab === key ? 'block' : 'none' }}>
            {panel}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Layout;

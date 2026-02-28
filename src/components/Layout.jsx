import { useState } from 'react';
import { UnderlineNav, Heading } from '@primer/react';

const TABS = [
  { key: 'settings', label: 'Settings' },
  { key: 'datasets', label: 'Datasets' },
  { key: 'experiments', label: 'Experiments' },
  { key: 'results', label: 'Results' },
  { key: 'logs', label: 'Logs' },
];

function Layout({ panels }) {
  const [activeTab, setActiveTab] = useState('settings');

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
          </UnderlineNav.Item>
        ))}
      </UnderlineNav>
      <div style={{ marginTop: '16px' }}>
        {panels[activeTab]}
      </div>
    </div>
  );
}

export default Layout;

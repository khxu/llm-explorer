import './App.css'
import { initSchema } from './db/schema.js';
import Layout from './components/Layout.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import DatasetPanel from './components/DatasetPanel.jsx';
import ExperimentBuilder from './components/ExperimentBuilder.jsx';
import ResultsView from './components/ResultsView.jsx';
import LogsPanel from './components/LogsPanel.jsx';

await initSchema();

function App() {
  return (
    <Layout panels={{
      settings: <SettingsPanel />,
      datasets: <DatasetPanel />,
      experiments: <ExperimentBuilder />,
      results: <ResultsView />,
      logs: <LogsPanel />,
    }} />
  );
}

export default App

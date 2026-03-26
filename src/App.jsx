import './App.css'
import { initSchema } from './db/schema.js';
import Layout from './components/Layout.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import DatasetPanel from './components/DatasetPanel.jsx';
import ExperimentBuilder from './components/ExperimentBuilder.jsx';
import ResultsView from './components/ResultsView.jsx';
import LogsPanel from './components/LogsPanel.jsx';
import BatchExportPanel from './components/BatchExportPanel.jsx';
import { useMachine } from '@xstate/react';
import { experimentMachine } from './machines/experimentMachine.js';

await initSchema();

function App() {
  const [machineState, machineSend] = useMachine(experimentMachine);

  return (
    <Layout
      machineState={machineState}
      panels={{
        settings: <SettingsPanel />,
        datasets: <DatasetPanel />,
        experiments: <ExperimentBuilder machineState={machineState} machineSend={machineSend} />,
        results: <ResultsView machineState={machineState} />,
        batchExport: <BatchExportPanel />,
        logs: <LogsPanel />,
      }}
    />
  );
}

export default App

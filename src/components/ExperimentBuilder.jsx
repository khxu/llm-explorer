import { useState, useEffect, useCallback } from 'react';
import {
  FormControl,
  TextInput,
  Select,
  Button,
  Flash,
  Text,
  Heading,
} from '@primer/react';
import { PROVIDER_NAMES } from '../providers/index.js';
import {
  getAllDatasets,
  getApiKey,
  getDatasetRows,
  createExperiment,
  getAllExperiments,
  getExperiment,
  updateExperiment,
  deleteExperiment,
  getActiveExecutionState,
  createExecutionState,
  deleteExecutionState,
  deleteRunResults,
  getRunResultsByRunId,
  updateExecutionStatus,
} from '../db/queries.js';
import PromptEditor from './PromptEditor.jsx';
import ModelSelector from './ModelSelector.jsx';
import ExecutionProgress from './ExecutionProgress.jsx';

export default function ExperimentBuilder({ machineState, machineSend }) {
  const state = machineState;
  const send = machineSend;

  // Form state
  const [name, setName] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [provider, setProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [selectedModels, setSelectedModels] = useState([]);
  const [temperature, setTemperature] = useState(1.0);
  const [maxTokens, setMaxTokens] = useState(1024);

  // Data state
  const [datasets, setDatasets] = useState([]);
  const [columns, setColumns] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [editingId, setEditingId] = useState(null);

  // UI state
  const [flash, setFlash] = useState(null);
  const [restoring, setRestoring] = useState(true);

  const loadData = useCallback(async () => {
    const [ds, exps] = await Promise.all([getAllDatasets(), getAllExperiments()]);
    setDatasets(ds);
    setExperiments(exps);
  }, []);

  useEffect(() => { loadData(); }, [loadData]); // eslint-disable-line react-hooks/set-state-in-effect

  // Restore execution state from DB on mount
  useEffect(() => {
    async function restoreExecution() {
      try {
        const execState = await getActiveExecutionState();
        if (!execState) return;

        const experiment = await getExperiment(execState.experiment_id);
        if (!experiment || !experiment.dataset_id) {
          await deleteExecutionState(execState.id);
          return;
        }

        const datasetRows = await getDatasetRows(experiment.dataset_id);
        if (datasetRows.length === 0) {
          await deleteExecutionState(execState.id);
          return;
        }

        const apiKeyRow = await getApiKey(execState.provider);
        const runResults = await getRunResultsByRunId(execState.id);

        // Clean up stale 'running' entries (in-flight when browser closed)
        const staleRunning = runResults.filter(r => r.status === 'running');
        if (staleRunning.length) {
          await deleteRunResults(staleRunning.map(r => r.id));
        }
        const validResults = runResults.filter(r => r.status !== 'running');

        // Build row_index lookup from dataset rows
        const rowIndexMap = new Map(datasetRows.map(r => [r.id, r.row_index]));

        // Reconstruct event-shaped results for the machine context
        const results = validResults.map(r => {
          const rowIndex = rowIndexMap.get(r.dataset_row_id) ?? 0;
          if (r.status === 'success') {
            return {
              type: 'RUN_COMPLETE',
              resultId: r.id,
              model: r.model,
              rowIndex,
              output: r.output,
              tokensInput: r.tokens_input,
              tokensOutput: r.tokens_output,
              latencyMs: r.latency_ms,
            };
          }
          return {
            type: 'RUN_ERROR',
            resultId: r.id,
            model: r.model,
            rowIndex,
            error: r.error,
          };
        });

        const total = datasetRows.length * experiment.models.length;
        const completed = results.length;
        const failed = results.filter(r => r.type === 'RUN_ERROR').length;

        // If status was 'running', it was interrupted — treat as paused
        const status = execState.status === 'completed' ? 'completed' : 'paused';
        if (execState.status === 'running') {
          await updateExecutionStatus(execState.id, 'paused');
        }

        send({
          type: 'RESTORE',
          experiment,
          datasetRows,
          provider: execState.provider,
          apiKey: apiKeyRow?.api_key || '',
          results,
          progress: { total, completed, failed },
          runId: execState.id,
          status,
        });

        // Populate form fields
        setEditingId(experiment.id);
        setName(experiment.name || '');
        setDatasetId(experiment.dataset_id ? String(experiment.dataset_id) : '');
        setSystemPrompt(experiment.system_prompt || '');
        setUserPrompt(experiment.user_prompt || '');
        setSelectedModels(experiment.models || []);
        setTemperature(experiment.temperature ?? 1.0);
        setMaxTokens(experiment.max_tokens ?? 1024);
        setProvider(execState.provider);
      } finally {
        setRestoring(false);
      }
    }
    restoreExecution();
  }, [send]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load API key when provider changes
  useEffect(() => {
    if (!provider) { setApiKey(''); return; } // eslint-disable-line react-hooks/set-state-in-effect
    getApiKey(provider).then((row) => setApiKey(row?.api_key || ''));
  }, [provider]);

  // Update columns when dataset changes
  useEffect(() => {
    const ds = datasets.find((d) => String(d.id) === String(datasetId));
    setColumns(ds?.columns || []); // eslint-disable-line react-hooks/set-state-in-effect
  }, [datasetId, datasets]);

  const resetForm = () => {
    setName('');
    setDatasetId('');
    setSystemPrompt('');
    setUserPrompt('');
    setProvider('');
    setApiKey('');
    setSelectedModels([]);
    setTemperature(1.0);
    setMaxTokens(1024);
    setEditingId(null);
  };

  const buildPayload = () => ({
    name,
    datasetId: datasetId ? Number(datasetId) : null,
    systemPrompt,
    userPrompt,
    models: selectedModels,
    temperature,
    maxTokens,
  });

  const handleSave = async () => {
    try {
      if (editingId) {
        await updateExperiment(editingId, buildPayload());
        setFlash({ variant: 'success', msg: 'Experiment updated.' });
      } else {
        await createExperiment(buildPayload());
        setFlash({ variant: 'success', msg: 'Experiment saved.' });
      }
      await loadData();
    } catch (err) {
      setFlash({ variant: 'danger', msg: err.message });
    }
  };

  const handleRun = async () => {
    try {
      // Save first
      let expId = editingId;
      if (expId) {
        await updateExperiment(expId, buildPayload());
      } else {
        expId = await createExperiment(buildPayload());
        setEditingId(expId);
      }
      await loadData();

      // Load the full experiment and dataset rows
      const experiment = await getExperiment(expId);
      if (!experiment) {
        setFlash({ variant: 'danger', msg: 'Experiment not found.' });
        return;
      }
      if (!experiment.dataset_id) {
        setFlash({ variant: 'danger', msg: 'Please select a dataset before running.' });
        return;
      }
      if (!provider || !apiKey) {
        setFlash({ variant: 'danger', msg: 'Please configure a provider and API key first.' });
        return;
      }
      if (experiment.models.length === 0) {
        setFlash({ variant: 'danger', msg: 'Please select at least one model.' });
        return;
      }

      const datasetRows = await getDatasetRows(experiment.dataset_id);
      if (datasetRows.length === 0) {
        setFlash({ variant: 'danger', msg: 'Dataset has no rows.' });
        return;
      }

      setFlash(null);
      const runId = await createExecutionState(expId, provider);
      send({ type: 'START', experiment, datasetRows, provider, apiKey, runId });
    } catch (err) {
      setFlash({ variant: 'danger', msg: err.message });
    }
  };

  const handleLoad = async (id) => {
    const exp = await getExperiment(id);
    if (!exp) return;
    setEditingId(exp.id);
    setName(exp.name || '');
    setDatasetId(exp.dataset_id ? String(exp.dataset_id) : '');
    setSystemPrompt(exp.system_prompt || '');
    setUserPrompt(exp.user_prompt || '');
    setSelectedModels(exp.models || []);
    setTemperature(exp.temperature ?? 1.0);
    setMaxTokens(exp.max_tokens ?? 1024);
    setFlash(null);
  };

  const handleDelete = async (id) => {
    await deleteExperiment(id);
    if (editingId === id) resetForm();
    await loadData();
    setFlash({ variant: 'success', msg: 'Experiment deleted.' });
  };

  if (restoring) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 0' }}>
        <Heading sx={{ mb: 3 }}>Experiment Builder</Heading>
        <Text color="fg.muted">Loading…</Text>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 0' }}>
      <Heading sx={{ mb: 3 }}>Experiment Builder</Heading>

      {flash && (
        <Flash variant={flash.variant} sx={{ mb: 3 }}>
          {flash.msg}
        </Flash>
      )}

      {/* Experiment name */}
      <FormControl sx={{ mb: 3 }}>
        <FormControl.Label>Experiment Name</FormControl.Label>
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My experiment"
          block
        />
      </FormControl>

      {/* Dataset selector */}
      <FormControl sx={{ mb: 3 }}>
        <FormControl.Label>Dataset</FormControl.Label>
        <Select value={datasetId} onChange={(e) => setDatasetId(e.target.value)}>
          <Select.Option value="">— Select a dataset —</Select.Option>
          {datasets.map((ds) => (
            <Select.Option key={ds.id} value={String(ds.id)}>
              {ds.name} ({ds.row_count} rows)
            </Select.Option>
          ))}
        </Select>
      </FormControl>

      {/* Prompt editors */}
      <div style={{ marginBottom: '16px' }}>
        <PromptEditor
          label="System Prompt"
          value={systemPrompt}
          onChange={setSystemPrompt}
          columns={columns}
        />
      </div>
      <div style={{ marginBottom: '16px' }}>
        <PromptEditor
          label="User Prompt"
          value={userPrompt}
          onChange={setUserPrompt}
          columns={columns}
        />
      </div>

      {/* Provider selector */}
      <FormControl sx={{ mb: 3 }}>
        <FormControl.Label>Provider</FormControl.Label>
        <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
          <Select.Option value="">— Select a provider —</Select.Option>
          {PROVIDER_NAMES.map((p) => (
            <Select.Option key={p} value={p}>
              {p}
            </Select.Option>
          ))}
        </Select>
      </FormControl>

      {/* Model selector */}
      {provider && apiKey && (
        <div style={{ marginBottom: '16px' }}>
          <Text as="label" fontWeight="bold" fontSize={1} sx={{ display: 'block', mb: 1 }}>
            Models
          </Text>
          <ModelSelector
            provider={provider}
            apiKey={apiKey}
            selectedModels={selectedModels}
            onChange={setSelectedModels}
          />
        </div>
      )}

      {/* Parameters */}
      <Heading as="h3" sx={{ fontSize: 2, mb: 2 }}>Parameters</Heading>

      <FormControl sx={{ mb: 3 }}>
        <FormControl.Label>
          Temperature: {temperature.toFixed(1)}
        </FormControl.Label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
          style={{ width: '100%' }}
        />
      </FormControl>

      <FormControl sx={{ mb: 3 }}>
        <FormControl.Label>Max Tokens</FormControl.Label>
        <TextInput
          type="number"
          value={String(maxTokens)}
          onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 0)}
          min={1}
          block
        />
      </FormControl>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', marginTop: '8px' }}>
        <Button variant="primary" onClick={handleSave}>
          {editingId ? 'Update Experiment' : 'Save Experiment'}
        </Button>
        <Button onClick={handleRun} disabled={state.matches('executing') || state.matches('paused')}>
          Run Experiment
        </Button>
        {editingId && (
          <Button variant="danger" onClick={() => { resetForm(); }}>
            Cancel Edit
          </Button>
        )}
      </div>

      {/* Execution progress */}
      {!state.matches('idle') && (
        <ExecutionProgress state={state} send={send} />
      )}

      {/* Existing experiments */}
      {experiments.length > 0 && (
        <>
          <Heading as="h3" sx={{ fontSize: 2, mb: 2 }}>Saved Experiments</Heading>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {experiments.map((exp) => (
              <li
                key={exp.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px',
                  borderBottom: '1px solid var(--borderColor-default, #d0d7de)',
                }}
              >
                <div>
                  <Text fontWeight="bold">{exp.name || `Experiment #${exp.id}`}</Text>
                  <Text fontSize={0} color="fg.muted" sx={{ ml: 2 }}>
                    {' '}· {exp.models?.length || 0} models · temp {exp.temperature}
                  </Text>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <Button size="small" onClick={() => handleLoad(exp.id)}>Edit</Button>
                  <Button size="small" variant="danger" onClick={() => handleDelete(exp.id)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

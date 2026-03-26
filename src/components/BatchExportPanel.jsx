import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Flash,
  FormControl,
  Heading,
  Select,
  Text,
  TextInput,
  Textarea,
} from '@primer/react';
import { getAllExperiments, getExperiment, getDatasetRows } from '../db/queries.js';
import { interpolate } from '../utils/template.js';
import { generateBatchJSONL, downloadJSONL } from '../utils/batchExport.js';

export default function BatchExportPanel({ isActive }) {
  const [experiments, setExperiments] = useState([]);
  const [selectedExpId, setSelectedExpId] = useState('');
  const [experiment, setExperiment] = useState(null);
  const [datasetRows, setDatasetRows] = useState([]);
  const [model, setModel] = useState('');
  const [preview, setPreview] = useState('');
  const [flash, setFlash] = useState(null);

  const loadExperiments = useCallback(async () => {
    const exps = await getAllExperiments();
    setExperiments(exps);
  }, []);

  useEffect(() => { loadExperiments(); }, [loadExperiments]); // eslint-disable-line react-hooks/set-state-in-effect

  // Re-fetch when tab becomes active
  useEffect(() => { if (isActive) loadExperiments(); }, [isActive, loadExperiments]); // eslint-disable-line react-hooks/set-state-in-effect

  // Load full experiment + dataset rows when selection changes
  useEffect(() => {
    if (!selectedExpId) {
      setExperiment(null); // eslint-disable-line react-hooks/set-state-in-effect
      setDatasetRows([]);
      setModel('');
      setPreview('');
      return;
    }
    (async () => {
      const exp = await getExperiment(Number(selectedExpId));
      if (!exp) return;
      setExperiment(exp);
      // Default to first model in experiment
      setModel(exp.models?.[0] || '');

      if (exp.dataset_id) {
        const rows = await getDatasetRows(exp.dataset_id);
        setDatasetRows(rows);
      } else {
        setDatasetRows([]);
      }
    })();
  }, [selectedExpId]);

  // Update preview whenever experiment, model, or rows change
  useEffect(() => {
    if (!experiment || !model || datasetRows.length === 0) {
      setPreview(''); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    const jsonl = generateBatchJSONL({ experiment, datasetRows: datasetRows.slice(0, 3), model });
    setPreview(jsonl);
  }, [experiment, model, datasetRows]);

  const handleExport = () => {
    if (!experiment || !model) {
      setFlash({ variant: 'danger', msg: 'Please select an experiment and model.' });
      return;
    }
    if (datasetRows.length === 0) {
      setFlash({ variant: 'danger', msg: 'The selected experiment has no dataset rows.' });
      return;
    }

    const jsonl = generateBatchJSONL({ experiment, datasetRows, model });
    const safeName = (experiment.name || 'batch').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeModel = model.replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadJSONL(`${safeName}_${safeModel}.jsonl`, jsonl);
    setFlash({ variant: 'success', msg: `Exported ${datasetRows.length} requests to JSONL.` });
  };

  // Build a sample interpolated message for display
  const sampleRow = datasetRows[0];
  const sampleSystem = sampleRow ? interpolate(experiment?.system_prompt || '', sampleRow.data) : '';
  const sampleUser = sampleRow ? interpolate(experiment?.user_prompt || '', sampleRow.data) : '';

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 0' }}>
      <Heading sx={{ mb: 2 }}>Batch Export</Heading>
      <Text as="p" color="fg.muted" sx={{ mb: 3 }}>
        Generate a JSONL file for{' '}
        <a href="https://platform.openai.com/docs/guides/batch" target="_blank" rel="noreferrer">
          OpenAI&apos;s Batch API
        </a>
        . Pick a saved experiment, choose a model, and download the file. Then upload it via OpenAI&apos;s web dashboard.
      </Text>

      {flash && (
        <Flash variant={flash.variant} sx={{ mb: 3 }}>
          {flash.msg}
        </Flash>
      )}

      {/* Experiment selector */}
      <FormControl sx={{ mb: 3 }}>
        <FormControl.Label>Experiment</FormControl.Label>
        <Select value={selectedExpId} onChange={(e) => setSelectedExpId(e.target.value)}>
          <Select.Option value="">— Select an experiment —</Select.Option>
          {experiments.map((exp) => (
            <Select.Option key={exp.id} value={String(exp.id)}>
              {exp.name || `Experiment #${exp.id}`}
            </Select.Option>
          ))}
        </Select>
      </FormControl>

      {/* Model input — user can type any OpenAI model name */}
      {experiment && (
        <>
          <FormControl sx={{ mb: 3 }}>
            <FormControl.Label>Model</FormControl.Label>
            {experiment.models?.length > 1 ? (
              <Select value={model} onChange={(e) => setModel(e.target.value)}>
                {experiment.models.map((m) => (
                  <Select.Option key={m} value={m}>{m}</Select.Option>
                ))}
              </Select>
            ) : (
              <TextInput
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. gpt-4o"
                block
              />
            )}
            <FormControl.Caption>
              The model name that will appear in each batch request.
            </FormControl.Caption>
          </FormControl>

          {/* Summary */}
          <div style={{
            border: '1px solid var(--borderColor-default, #d0d7de)',
            borderRadius: '6px',
            padding: '16px',
            marginBottom: '16px',
          }}>
            <Heading as="h3" sx={{ fontSize: 2, mb: 2 }}>Summary</Heading>
            <Text as="p" sx={{ mb: 1 }}>
              <strong>Dataset rows:</strong> {datasetRows.length}
            </Text>
            <Text as="p" sx={{ mb: 1 }}>
              <strong>Model:</strong> {model || '(none)'}
            </Text>
            <Text as="p" sx={{ mb: 1 }}>
              <strong>Temperature:</strong> {experiment.temperature}
            </Text>
            <Text as="p" sx={{ mb: 1 }}>
              <strong>Max tokens:</strong> {experiment.max_tokens}
            </Text>

            {sampleRow && (
              <>
                <Heading as="h4" sx={{ fontSize: 1, mt: 3, mb: 1 }}>Sample (Row 0)</Heading>
                {sampleSystem && (
                  <div style={{ marginBottom: '8px' }}>
                    <Text fontSize={0} color="fg.muted" fontWeight="bold">System:</Text>
                    <div style={{
                      backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
                      padding: '8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: '120px',
                      overflowY: 'auto',
                    }}>
                      {sampleSystem}
                    </div>
                  </div>
                )}
                {sampleUser && (
                  <div>
                    <Text fontSize={0} color="fg.muted" fontWeight="bold">User:</Text>
                    <div style={{
                      backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
                      padding: '8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: '120px',
                      overflowY: 'auto',
                    }}>
                      {sampleUser}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* JSONL Preview */}
          {preview && (
            <div style={{ marginBottom: '16px' }}>
              <FormControl>
                <FormControl.Label>JSONL Preview (first {Math.min(3, datasetRows.length)} rows)</FormControl.Label>
                <Textarea
                  value={preview}
                  readOnly
                  rows={Math.min(10, preview.split('\n').length + 1)}
                  block
                  sx={{ fontFamily: 'monospace', fontSize: '12px' }}
                />
              </FormControl>
            </div>
          )}

          {/* Export button */}
          <Button variant="primary" onClick={handleExport} disabled={!model || datasetRows.length === 0}>
            Download JSONL ({datasetRows.length} requests)
          </Button>
        </>
      )}

      {experiments.length === 0 && (
        <Flash variant="warning" sx={{ mt: 3 }}>
          No experiments found. Create one in the Experiments tab first.
        </Flash>
      )}
    </div>
  );
}

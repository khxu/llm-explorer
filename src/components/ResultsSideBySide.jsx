import { useState, useEffect, useCallback } from 'react';
import { Text, Heading, Button, Spinner } from '@primer/react';
import { getExperiment, getRunResults, getDatasetRows } from '../db/queries.js';

const statusIcon = (status) => {
  if (status === 'success') return '✓';
  if (status === 'error') return '✗';
  return '⏳';
};

const statusColor = (status) => {
  if (status === 'success') return 'var(--fgColor-success, #1a7f37)';
  if (status === 'error') return 'var(--fgColor-danger, #cf222e)';
  return 'var(--fgColor-muted, #656d76)';
};

export default function ResultsSideBySide({ experimentId, refreshKey }) {
  const [experiment, setExperiment] = useState(null);
  const [results, setResults] = useState([]);
  const [datasetRows, setDatasetRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const loadData = useCallback(async () => {
    if (!experimentId) return;
    setLoading(true);
    setError(null);
    try {
      const exp = await getExperiment(experimentId);
      setExperiment(exp);
      const runResults = await getRunResults(experimentId);
      setResults(runResults);
      if (exp?.dataset_id) {
        const rows = await getDatasetRows(exp.dataset_id);
        setDatasetRows(rows);
      } else {
        setDatasetRows([]);
      }
      setCurrentIndex(0);
    } catch (e) {
      setError(`Failed to load results: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [experimentId, refreshKey]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  if (!experimentId) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <Text style={{ color: 'var(--fgColor-muted, #656d76)' }}>Select an experiment to view results.</Text>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <Spinner size="medium" />
      </div>
    );
  }

  if (error) {
    return <Text style={{ color: 'var(--fgColor-danger, #cf222e)' }}>{error}</Text>;
  }

  if (!experiment) {
    return <Text>Experiment not found.</Text>;
  }

  if (datasetRows.length === 0) {
    return (
      <Text style={{ color: 'var(--fgColor-muted, #656d76)', textAlign: 'center' }}>
        No dataset rows to compare.
      </Text>
    );
  }

  const currentRow = datasetRows[currentIndex];
  const modelNames = experiment.models || [];

  // Group results by dataset_row_id → model
  const resultsByRow = {};
  for (const r of results) {
    if (!resultsByRow[r.dataset_row_id]) resultsByRow[r.dataset_row_id] = {};
    resultsByRow[r.dataset_row_id][r.model] = r;
  }

  const rowResults = resultsByRow[currentRow?.id] || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Row selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <Button
          size="small"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((i) => i - 1)}
        >
          ← Prev
        </Button>
        <select
          value={currentIndex}
          onChange={(e) => setCurrentIndex(Number(e.target.value))}
          style={{
            padding: '4px 8px',
            borderRadius: '6px',
            border: '1px solid var(--borderColor-default, #d0d7de)',
            fontSize: '14px',
          }}
        >
          {datasetRows.map((row, i) => (
            <option key={row.id} value={i}>
              Row {row.row_index} (ID: {row.id})
            </option>
          ))}
        </select>
        <Button
          size="small"
          disabled={currentIndex >= datasetRows.length - 1}
          onClick={() => setCurrentIndex((i) => i + 1)}
        >
          Next →
        </Button>
        <Text style={{ color: 'var(--fgColor-muted, #656d76)', fontSize: '12px' }}>
          {currentIndex + 1} of {datasetRows.length}
        </Text>
      </div>

      {/* Input data display */}
      <div style={{
        border: '1px solid var(--borderColor-default, #d0d7de)',
        borderRadius: '6px',
        padding: '12px',
        backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
      }}>
        <Heading as="h4" style={{ marginBottom: '8px' }}>Input Data</Heading>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {Object.entries(currentRow.data).map(([key, value]) => (
            <div key={key}>
              <Text style={{ fontSize: '11px', color: 'var(--fgColor-muted, #656d76)', fontWeight: 'bold' }}>
                {key}
              </Text>
              <div style={{ fontSize: '13px' }}>{value != null ? String(value) : '—'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Model output panels side by side */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {modelNames.map((model) => {
          const result = rowResults[model];
          return (
            <div
              key={model}
              style={{
                flex: '1 1 300px',
                border: '1px solid var(--borderColor-default, #d0d7de)',
                borderRadius: '6px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <Heading as="h4">{model}</Heading>

              {!result ? (
                <Text style={{ color: 'var(--fgColor-muted, #656d76)' }}>No result</Text>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: '12px' }}>
                      Status:{' '}
                      <span style={{ color: statusColor(result.status) }}>
                        {statusIcon(result.status)} {result.status}
                      </span>
                    </Text>
                    {result.tokens_input != null && (
                      <Text style={{ fontSize: '12px', color: 'var(--fgColor-muted, #656d76)' }}>
                        Tokens in: {result.tokens_input}
                      </Text>
                    )}
                    {result.tokens_output != null && (
                      <Text style={{ fontSize: '12px', color: 'var(--fgColor-muted, #656d76)' }}>
                        Tokens out: {result.tokens_output}
                      </Text>
                    )}
                    {result.latency_ms != null && (
                      <Text style={{ fontSize: '12px', color: 'var(--fgColor-muted, #656d76)' }}>
                        Latency: {result.latency_ms}ms
                      </Text>
                    )}
                  </div>

                  <pre style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    margin: 0,
                    fontSize: '13px',
                    fontFamily: 'var(--fontStack-monospace, monospace)',
                    backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
                    padding: '8px',
                    borderRadius: '4px',
                    flex: 1,
                  }}>
                    {result.output || result.error || 'No output'}
                  </pre>
                </>
              )}
            </div>
          );
        })}
      </div>

      {modelNames.length === 0 && (
        <Text style={{ color: 'var(--fgColor-muted, #656d76)' }}>
          No models configured for this experiment.
        </Text>
      )}
    </div>
  );
}

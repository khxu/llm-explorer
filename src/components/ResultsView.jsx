import { useState, useEffect, useCallback } from 'react';
import { Text, Heading, Button, Flash, Spinner } from '@primer/react';
import { getAllExperiments, getExperiment, getRunResults, getDatasetRows } from '../db/queries.js';
import { exportToCSV, exportToJSON, formatResultsForExport } from '../utils/export.js';
import ResultsTable from './ResultsTable.jsx';
import ResultsSideBySide from './ResultsSideBySide.jsx';

export default function ResultsView({ machineState }) {
  const [experiments, setExperiments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState('table');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadExperiments = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllExperiments();
      setExperiments(all);
    } catch (e) {
      setError(`Failed to load experiments: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  // Auto-refresh when machine transitions to completed
  const machineValue = machineState ? (typeof machineState.value === 'string' ? machineState.value : Object.keys(machineState.value)[0]) : null;
  useEffect(() => {
    if (machineValue === 'completed') {
      loadExperiments();
      setRefreshKey((k) => k + 1);
    }
  }, [machineValue, loadExperiments]);

  const handleExport = async (format) => {
    if (!selectedId) return;
    setExporting(true);
    setError(null);
    try {
      const exp = await getExperiment(selectedId);
      const runResults = await getRunResults(selectedId);
      const datasetRows = exp?.dataset_id ? await getDatasetRows(exp.dataset_id) : [];
      const { columns, rows } = formatResultsForExport(runResults, datasetRows);
      const safeName = (exp?.name || 'results').replace(/[^a-zA-Z0-9_-]/g, '_');

      if (format === 'csv') {
        exportToCSV(`${safeName}.csv`, columns, rows);
      } else {
        exportToJSON(`${safeName}.json`, rows);
      }
    } catch (e) {
      setError(`Export failed: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  const toggleStyle = (active) => ({
    fontWeight: active ? 'bold' : 'normal',
    borderBottom: active ? '2px solid var(--borderColor-accent-emphasis, #0969da)' : '2px solid transparent',
    borderRadius: 0,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Heading as="h2">Results</Heading>

      {error && (
        <Flash variant="danger">
          {error}
          <Button variant="invisible" style={{ marginLeft: '8px', padding: 0 }} onClick={() => setError(null)}>✕</Button>
        </Flash>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px' }}>
          <Spinner size="medium" />
        </div>
      ) : experiments.length === 0 ? (
        <Text style={{ color: 'var(--fgColor-muted, #656d76)' }}>
          No experiments yet. Create an experiment first.
        </Text>
      ) : (
        <>
          {/* Controls row */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Experiment selector */}
            <select
              value={selectedId ?? ''}
              onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
              style={{
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid var(--borderColor-default, #d0d7de)',
                fontSize: '14px',
                minWidth: '200px',
              }}
            >
              <option value="">— Select experiment —</option>
              {experiments.map((exp) => (
                <option key={exp.id} value={exp.id}>{exp.name}</option>
              ))}
            </select>

            {/* View toggle */}
            <div style={{ display: 'flex', border: '1px solid var(--borderColor-default, #d0d7de)', borderRadius: '6px', overflow: 'hidden' }}>
              <Button
                variant="invisible"
                size="small"
                style={toggleStyle(view === 'table')}
                onClick={() => setView('table')}
              >
                Table
              </Button>
              <Button
                variant="invisible"
                size="small"
                style={toggleStyle(view === 'sidebyside')}
                onClick={() => setView('sidebyside')}
              >
                Side by Side
              </Button>
            </div>

            {/* Export buttons */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <Button
                size="small"
                disabled={!selectedId || exporting}
                onClick={() => handleExport('csv')}
              >
                Export CSV
              </Button>
              <Button
                size="small"
                disabled={!selectedId || exporting}
                onClick={() => handleExport('json')}
              >
                Export JSON
              </Button>
            </div>
          </div>

          {/* Results content */}
          {view === 'table' ? (
            <ResultsTable experimentId={selectedId} refreshKey={refreshKey} />
          ) : (
            <ResultsSideBySide experimentId={selectedId} refreshKey={refreshKey} />
          )}
        </>
      )}
    </div>
  );
}

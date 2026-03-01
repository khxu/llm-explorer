import { useState, useEffect, useCallback } from 'react';
import { Text, Heading, Spinner } from '@primer/react';
import { DataTable, Table } from '@primer/react/experimental';
import { getExperiment, getRunResults, getDatasetRows } from '../db/queries.js';

const PAGE_SIZE = 10;

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

export default function ResultsTable({ experimentId, refreshKey }) {
  const [experiment, setExperiment] = useState(null);
  const [results, setResults] = useState([]);
  const [datasetRows, setDatasetRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedCell, setSelectedCell] = useState(null);

  const loadData = useCallback(async () => {
    if (!experimentId) return;
    setLoading(true);
    setError(null);
    setSelectedCell(null);
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
      setPageIndex(0);
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

  // Group results by dataset_row_id → model
  const resultsByRow = {};
  for (const r of results) {
    if (!resultsByRow[r.dataset_row_id]) resultsByRow[r.dataset_row_id] = {};
    resultsByRow[r.dataset_row_id][r.model] = r;
  }

  const modelNames = experiment.models || [];
  const dataColumns = datasetRows.length > 0 ? Object.keys(datasetRows[0].data) : [];

  // Build table columns
  const columns = [
    ...dataColumns.map((col) => ({
      header: col,
      field: `data_${col}`,
      renderCell: (row) => {
        const val = row[`data_${col}`];
        return val != null ? String(val) : '';
      },
    })),
    ...modelNames.map((model) => ({
      header: model,
      field: `model_${model}`,
      renderCell: (row) => {
        const result = row[`_result_${model}`];
        if (!result) return <Text style={{ color: 'var(--fgColor-muted, #656d76)' }}>—</Text>;
        const icon = statusIcon(result.status);
        const color = statusColor(result.status);
        const preview = result.output
          ? result.output.length > 80 ? result.output.slice(0, 80) + '…' : result.output
          : result.error || '';
        return (
          <span
            style={{ cursor: 'pointer', color }}
            onClick={() => setSelectedCell(result)}
            title="Click to view full output"
          >
            {icon} {preview}
          </span>
        );
      },
    })),
  ];

  // Build table rows
  const tableData = datasetRows.map((row) => {
    const entry = { id: row.id };
    for (const col of dataColumns) {
      entry[`data_${col}`] = row.data[col];
    }
    for (const model of modelNames) {
      const result = resultsByRow[row.id]?.[model];
      entry[`model_${model}`] = result ? statusIcon(result.status) : '';
      entry[`_result_${model}`] = result || null;
    }
    return entry;
  });

  const start = pageIndex * PAGE_SIZE;
  const pageData = tableData.slice(start, start + PAGE_SIZE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Table.Container>
        <Table.Title as="h3" id="results-table-title">
          {experiment.name} — Results
        </Table.Title>
        <DataTable
          aria-labelledby="results-table-title"
          data={pageData}
          columns={columns}
        />
        {tableData.length > PAGE_SIZE && (
          <Table.Pagination
            aria-label="Results pagination"
            pageSize={PAGE_SIZE}
            totalCount={tableData.length}
            onChange={({ pageIndex: pi }) => setPageIndex(pi)}
          />
        )}
      </Table.Container>

      {selectedCell && (
        <div style={{
          border: '1px solid var(--borderColor-default, #d0d7de)',
          borderRadius: '6px',
          padding: '16px',
          backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <Heading as="h4">{selectedCell.model} — Detail</Heading>
            <span
              style={{ cursor: 'pointer', fontSize: '16px' }}
              onClick={() => setSelectedCell(null)}
            >✕</span>
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <Text style={{ fontSize: '12px', color: 'var(--fgColor-muted, #656d76)' }}>
              Status: <span style={{ color: statusColor(selectedCell.status) }}>{selectedCell.status}</span>
            </Text>
            {selectedCell.tokens_input != null && (
              <Text style={{ fontSize: '12px', color: 'var(--fgColor-muted, #656d76)' }}>
                Tokens in: {selectedCell.tokens_input}
              </Text>
            )}
            {selectedCell.tokens_output != null && (
              <Text style={{ fontSize: '12px', color: 'var(--fgColor-muted, #656d76)' }}>
                Tokens out: {selectedCell.tokens_output}
              </Text>
            )}
            {selectedCell.latency_ms != null && (
              <Text style={{ fontSize: '12px', color: 'var(--fgColor-muted, #656d76)' }}>
                Latency: {selectedCell.latency_ms}ms
              </Text>
            )}
          </div>
          <pre style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
            fontSize: '13px',
            fontFamily: 'var(--fontStack-monospace, monospace)',
          }}>
            {selectedCell.output || selectedCell.error || 'No output'}
          </pre>
        </div>
      )}

      {tableData.length === 0 && (
        <Text style={{ color: 'var(--fgColor-muted, #656d76)', textAlign: 'center' }}>
          No results yet. Run the experiment to generate outputs.
        </Text>
      )}
    </div>
  );
}

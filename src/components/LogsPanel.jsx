import { useState, useEffect, useCallback } from 'react';
import { Text, Heading, Button, Spinner, FormControl, Select } from '@primer/react';
import { DataTable, Table } from '@primer/react/experimental';
import { getAllExperiments, getLogs } from '../db/queries.js';

const PAGE_SIZE = 20;

const levelColors = {
  info: 'var(--fgColor-default, #1f2328)',
  warn: 'var(--fgColor-attention, #9a6700)',
  error: 'var(--fgColor-danger, #cf222e)',
  debug: 'var(--fgColor-muted, #656d76)',
};

const levelBgColors = {
  info: 'transparent',
  warn: 'var(--bgColor-attention-muted, #fff8c5)',
  error: 'var(--bgColor-danger-muted, #ffebe9)',
  debug: 'var(--bgColor-muted, #f6f8fa)',
};

export default function LogsPanel() {
  const [experiments, setExperiments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [expandedId, setExpandedId] = useState(null);

  // Filters
  const [filterExperiment, setFilterExperiment] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterLimit, setFilterLimit] = useState(100);

  const loadExperiments = useCallback(async () => {
    try {
      const all = await getAllExperiments();
      setExperiments(all);
    } catch {
      // non-critical
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { limit: filterLimit };
      if (filterExperiment) params.experimentId = Number(filterExperiment);
      if (filterLevel) params.level = filterLevel;
      const rows = await getLogs(params);
      setLogs(rows);
      setPageIndex(0);
    } catch (e) {
      setError(`Failed to load logs: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [filterExperiment, filterLevel, filterLimit]);

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const columns = [
    {
      header: 'Time',
      field: 'created_at',
      renderCell: (row) => (
        <Text style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
          {new Date(row.created_at).toLocaleString()}
        </Text>
      ),
    },
    {
      header: 'Level',
      field: 'level',
      renderCell: (row) => (
        <span style={{
          color: levelColors[row.level] || levelColors.info,
          backgroundColor: levelBgColors[row.level] || 'transparent',
          padding: '1px 6px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
        }}>
          {row.level}
        </span>
      ),
    },
    {
      header: 'Message',
      field: 'message',
      renderCell: (row) => (
        <Text style={{ fontSize: '13px', wordBreak: 'break-word' }}>
          {row.message}
        </Text>
      ),
    },
    {
      header: 'Meta',
      field: 'metadata',
      renderCell: (row) => {
        if (!row.metadata) return <Text style={{ color: 'var(--fgColor-muted, #656d76)' }}>—</Text>;
        const isExpanded = expandedId === row.id;
        return (
          <span
            style={{ cursor: 'pointer', color: 'var(--fgColor-accent, #0969da)', fontSize: '12px' }}
            onClick={() => setExpandedId(isExpanded ? null : row.id)}
          >
            {isExpanded ? '▾ collapse' : '▸ expand'}
          </span>
        );
      },
    },
  ];

  const start = pageIndex * PAGE_SIZE;
  const pageData = logs.slice(start, start + PAGE_SIZE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Heading as="h2">Logs</Heading>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <FormControl>
          <FormControl.Label>Experiment</FormControl.Label>
          <Select value={filterExperiment} onChange={(e) => setFilterExperiment(e.target.value)}>
            <Select.Option value="">All</Select.Option>
            {experiments.map((exp) => (
              <Select.Option key={exp.id} value={String(exp.id)}>{exp.name}</Select.Option>
            ))}
          </Select>
        </FormControl>

        <FormControl>
          <FormControl.Label>Level</FormControl.Label>
          <Select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}>
            <Select.Option value="">All</Select.Option>
            <Select.Option value="info">Info</Select.Option>
            <Select.Option value="warn">Warn</Select.Option>
            <Select.Option value="error">Error</Select.Option>
            <Select.Option value="debug">Debug</Select.Option>
          </Select>
        </FormControl>

        <FormControl>
          <FormControl.Label>Limit</FormControl.Label>
          <Select value={String(filterLimit)} onChange={(e) => setFilterLimit(Number(e.target.value))}>
            <Select.Option value="50">50</Select.Option>
            <Select.Option value="100">100</Select.Option>
            <Select.Option value="500">500</Select.Option>
          </Select>
        </FormControl>

        <Button size="small" onClick={loadLogs} disabled={loading}>
          {loading ? 'Loading…' : '↻ Refresh'}
        </Button>
      </div>

      {error && (
        <Text style={{ color: 'var(--fgColor-danger, #cf222e)' }}>{error}</Text>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px' }}>
          <Spinner size="medium" />
        </div>
      ) : logs.length === 0 ? (
        <Text style={{ color: 'var(--fgColor-muted, #656d76)' }}>No logs found.</Text>
      ) : (
        <>
          <Table.Container>
            <DataTable
              aria-label="Logs"
              data={pageData}
              columns={columns}
            />
            {logs.length > PAGE_SIZE && (
              <Table.Pagination
                aria-label="Logs pagination"
                pageSize={PAGE_SIZE}
                totalCount={logs.length}
                onChange={({ pageIndex: pi }) => setPageIndex(pi)}
              />
            )}
          </Table.Container>

          {/* Expanded metadata display */}
          {expandedId && (() => {
            const log = logs.find((l) => l.id === expandedId);
            if (!log?.metadata) return null;
            return (
              <div style={{
                border: '1px solid var(--borderColor-default, #d0d7de)',
                borderRadius: '6px',
                padding: '12px',
                backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <Text style={{ fontWeight: 'bold', fontSize: '12px' }}>Metadata (Log #{expandedId})</Text>
                  <span style={{ cursor: 'pointer' }} onClick={() => setExpandedId(null)}>✕</span>
                </div>
                <pre style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                  fontSize: '12px',
                  fontFamily: 'var(--fontStack-monospace, monospace)',
                }}>
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

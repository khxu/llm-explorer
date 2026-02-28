import { useState, useEffect, useCallback } from 'react';
import { Text, Heading, Button, Flash, FormControl, TextInput } from '@primer/react';
import { DataTable, Table } from '@primer/react/experimental';
import { parseCSV } from '../utils/csv.js';
import {
  createDataset,
  insertDatasetRows,
  getAllDatasets,
  getDatasetRows,
  deleteDataset,
} from '../db/queries.js';

const dropZoneBase = {
  border: '2px dashed',
  borderColor: 'var(--borderColor-default, #d0d7de)',
  borderRadius: '6px',
  padding: '32px',
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'border-color 0.15s, background-color 0.15s',
};

const dropZoneActive = {
  ...dropZoneBase,
  borderColor: 'var(--borderColor-accent-emphasis, #0969da)',
  backgroundColor: 'var(--bgColor-accent-muted, #ddf4ff)',
};

const PAGE_SIZE = 10;

export default function DatasetPanel() {
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [selectedDatasetRows, setSelectedDatasetRows] = useState([]);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [datasetName, setDatasetName] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [rowsPageIndex, setRowsPageIndex] = useState(0);

  const loadDatasets = useCallback(async () => {
    try {
      const all = await getAllDatasets();
      setDatasets(all);
    } catch (e) {
      setError(`Failed to load datasets: ${e.message}`);
    }
  }, []);

  useEffect(() => {
    loadDatasets();
  }, [loadDatasets]);

  const handleFile = async (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      setError('Please select a .csv file.');
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      const { columns, rows } = await parseCSV(file);
      setUploadPreview({ file, columns, rows });
      setDatasetName(file.name.replace(/\.csv$/i, ''));
      setPreviewPageIndex(0);
    } catch (e) {
      setError(`Failed to parse CSV: ${e.message}`);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  const handleSaveDataset = async () => {
    if (!uploadPreview) return;
    setIsUploading(true);
    setError(null);
    try {
      const { columns, rows } = uploadPreview;
      const name = datasetName.trim() || 'Untitled';
      const datasetId = await createDataset(name, columns, rows.length);
      const datasetRows = rows.map((data, i) => ({ rowIndex: i, data }));
      await insertDatasetRows(datasetId, datasetRows);
      setUploadPreview(null);
      setDatasetName('');
      setSuccess(`Dataset "${name}" saved with ${rows.length} rows.`);
      await loadDatasets();
    } catch (e) {
      setError(`Failed to save dataset: ${e.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectDataset = async (dataset) => {
    if (selectedDataset?.id === dataset.id) {
      setSelectedDataset(null);
      setSelectedDatasetRows([]);
      return;
    }
    try {
      const rows = await getDatasetRows(dataset.id);
      setSelectedDataset(dataset);
      setSelectedDatasetRows(rows);
      setRowsPageIndex(0);
    } catch (e) {
      setError(`Failed to load rows: ${e.message}`);
    }
  };

  const handleDeleteDataset = async (id) => {
    try {
      await deleteDataset(id);
      if (selectedDataset?.id === id) {
        setSelectedDataset(null);
        setSelectedDatasetRows([]);
      }
      setSuccess('Dataset deleted.');
      await loadDatasets();
    } catch (e) {
      setError(`Failed to delete dataset: ${e.message}`);
    }
  };

  const cancelUpload = () => {
    setUploadPreview(null);
    setDatasetName('');
  };

  // Build preview DataTable columns from CSV columns
  const previewColumns = uploadPreview
    ? uploadPreview.columns.map((col) => ({
        header: col,
        field: col,
        renderCell: (row) => {
          const val = row[col];
          return val != null ? String(val) : '';
        },
      }))
    : [];

  const previewStart = previewPageIndex * PAGE_SIZE;
  const previewRowsToShow = uploadPreview
    ? uploadPreview.rows.slice(previewStart, previewStart + PAGE_SIZE).map((r, i) => ({ id: previewStart + i, ...r }))
    : [];

  // Build DataTable columns for selected dataset rows
  const selectedColumns = selectedDataset
    ? selectedDataset.columns.map((col) => ({
        header: col,
        field: col,
        renderCell: (row) => {
          const val = row[col];
          return val != null ? String(val) : '';
        },
      }))
    : [];

  const rowsStart = rowsPageIndex * PAGE_SIZE;
  const selectedRowsToShow = selectedDatasetRows
    .slice(rowsStart, rowsStart + PAGE_SIZE)
    .map((r) => ({ id: r.id, ...r.data }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Heading as="h2">Datasets</Heading>

      {error && (
        <Flash variant="danger" style={{ marginBottom: '8px' }}>
          {error}
          <Button variant="invisible" style={{ marginLeft: '8px', padding: 0 }} onClick={() => setError(null)}>✕</Button>
        </Flash>
      )}
      {success && (
        <Flash variant="success" style={{ marginBottom: '8px' }}>
          {success}
          <Button variant="invisible" style={{ marginLeft: '8px', padding: 0 }} onClick={() => setSuccess(null)}>✕</Button>
        </Flash>
      )}

      {/* CSV Upload Section */}
      <div style={{ border: '1px solid var(--borderColor-default, #d0d7de)', borderRadius: '6px', padding: '16px' }}>
        <Heading as="h3" style={{ marginBottom: '8px' }}>Upload CSV</Heading>

        {!uploadPreview ? (
          <>
            <div
              style={dragActive ? dropZoneActive : dropZoneBase}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => document.getElementById('csv-file-input').click()}
            >
              <Text>
                Drag &amp; drop a CSV file here, or click to browse
              </Text>
            </div>
            <input
              id="csv-file-input"
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Text style={{ fontWeight: 'bold' }}>
                {uploadPreview.columns.length} columns, {uploadPreview.rows.length} rows
              </Text>
            </div>

            <FormControl>
              <FormControl.Label>Dataset Name</FormControl.Label>
              <TextInput
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                placeholder="Enter dataset name"
              />
            </FormControl>

            <Text style={{ fontWeight: 'bold' }}>Preview (first rows)</Text>
            <Table.Container>
              <DataTable
                aria-label="CSV preview"
                data={previewRowsToShow}
                columns={previewColumns}
              />
              {uploadPreview.rows.length > PAGE_SIZE && (
                <Table.Pagination
                  aria-label="Preview pagination"
                  pageSize={PAGE_SIZE}
                  totalCount={Math.min(uploadPreview.rows.length, 50)}
                  onChange={({ pageIndex }) => setPreviewPageIndex(pageIndex)}
                />
              )}
            </Table.Container>

            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="primary" onClick={handleSaveDataset} disabled={isUploading}>
                {isUploading ? 'Saving…' : 'Save Dataset'}
              </Button>
              <Button onClick={cancelUpload}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      {/* Existing Datasets List */}
      <div style={{ border: '1px solid var(--borderColor-default, #d0d7de)', borderRadius: '6px', padding: '16px' }}>
        <Heading as="h3" style={{ marginBottom: '8px' }}>Saved Datasets</Heading>

        {datasets.length === 0 ? (
          <Text>No datasets yet. Upload a CSV to get started.</Text>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {datasets.map((ds) => (
              <div
                key={ds.id}
                style={{
                  border: '1px solid',
                  borderColor: selectedDataset?.id === ds.id ? 'var(--borderColor-accent-emphasis, #0969da)' : 'var(--borderColor-default, #d0d7de)',
                  borderRadius: '6px',
                  padding: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div
                    style={{ cursor: 'pointer', flex: 1 }}
                    onClick={() => handleSelectDataset(ds)}
                  >
                    <Text style={{ fontWeight: 'bold' }}>{ds.name}</Text>
                    <Text style={{ color: 'var(--fgColor-muted, #656d76)', marginLeft: '8px', fontSize: '12px' }}>
                      {ds.columns.length} columns · {ds.row_count} rows · {new Date(ds.created_at).toLocaleDateString()}
                    </Text>
                  </div>
                  <Button
                    variant="danger"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDataset(ds.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>

                {selectedDataset?.id === ds.id && (
                  <div style={{ marginTop: '12px' }}>
                    <Table.Container>
                      <Table.Title as="h4" id={`dataset-${ds.id}`}>
                        {ds.name} — Rows
                      </Table.Title>
                      <DataTable
                        aria-labelledby={`dataset-${ds.id}`}
                        data={selectedRowsToShow}
                        columns={selectedColumns}
                      />
                      {selectedDatasetRows.length > PAGE_SIZE && (
                        <Table.Pagination
                          aria-label={`Pagination for ${ds.name}`}
                          pageSize={PAGE_SIZE}
                          totalCount={selectedDatasetRows.length}
                          onChange={({ pageIndex }) => setRowsPageIndex(pageIndex)}
                        />
                      )}
                    </Table.Container>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { generateCSVBlob } from './csv.js';

export function exportToCSV(filename, columns, rows) {
  const blob = generateCSVBlob(columns, rows);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatResultsForExport(runResults, datasetRows) {
  const modelNames = [...new Set(runResults.map((r) => r.model))];

  // Group results by dataset_row_id → model → output
  const grouped = {};
  for (const result of runResults) {
    if (!grouped[result.dataset_row_id]) {
      grouped[result.dataset_row_id] = {};
    }
    grouped[result.dataset_row_id][result.model] = result.output;
  }

  // datasetRows have { id, dataset_id, row_index, data } — flatten data into export rows
  const dataColumns = datasetRows.length > 0 ? Object.keys(datasetRows[0].data) : [];
  const rows = datasetRows.map((row) => {
    const exportRow = { ...row.data };
    for (const model of modelNames) {
      exportRow[model] = grouped[row.id]?.[model] ?? '';
    }
    return exportRow;
  });

  return { columns: [...dataColumns, ...modelNames], rows };
}

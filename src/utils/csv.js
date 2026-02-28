import Papa from 'papaparse';

export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve({ columns: results.meta.fields, rows: results.data });
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

export function generateCSVBlob(columns, rows) {
  const csv = Papa.unparse({ fields: columns, data: rows });
  return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}

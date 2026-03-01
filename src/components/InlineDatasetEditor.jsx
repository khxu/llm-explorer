import { useState } from 'react';
import { Button, Text, Heading, FormControl, TextInput } from '@primer/react';

const MAX_ROWS = 10;
const MAX_COLS = 3;

const cellStyle = {
  border: '1px solid var(--borderColor-default, #d0d7de)',
  padding: 0,
};

const inputStyle = {
  width: '100%',
  border: 'none',
  padding: '6px 8px',
  fontSize: '13px',
  fontFamily: 'inherit',
  background: 'transparent',
  outline: 'none',
  boxSizing: 'border-box',
};

const headerInputStyle = {
  ...inputStyle,
  fontWeight: 600,
  backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
};

function makeEmptyRow(colCount) {
  return Array(colCount).fill('');
}

export default function InlineDatasetEditor({ onSave }) {
  const [colCount, setColCount] = useState(2);
  const [headers, setHeaders] = useState(['column_1', 'column_2']);
  const [rows, setRows] = useState([makeEmptyRow(2)]);
  const [name, setName] = useState('');

  const updateHeader = (colIdx, value) => {
    setHeaders((prev) => prev.map((h, i) => (i === colIdx ? value : h)));
  };

  const updateCell = (rowIdx, colIdx, value) => {
    setRows((prev) =>
      prev.map((row, ri) =>
        ri === rowIdx ? row.map((cell, ci) => (ci === colIdx ? value : cell)) : row
      )
    );
  };

  const addRow = () => {
    if (rows.length >= MAX_ROWS) return;
    setRows((prev) => [...prev, makeEmptyRow(colCount)]);
  };

  const removeRow = (rowIdx) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== rowIdx));
  };

  const addColumn = () => {
    if (colCount >= MAX_COLS) return;
    setHeaders((prev) => [...prev, `column_${colCount + 1}`]);
    setRows((prev) => prev.map((row) => [...row, '']));
    setColCount((c) => c + 1);
  };

  const removeColumn = (colIdx) => {
    if (colCount <= 1) return;
    setHeaders((prev) => prev.filter((_, i) => i !== colIdx));
    setRows((prev) => prev.map((row) => row.filter((_, i) => i !== colIdx)));
    setColCount((c) => c - 1);
  };

  const handleSave = () => {
    const columns = headers.map((h) => h.trim() || `column_${headers.indexOf(h) + 1}`);
    // Deduplicate column names
    const seen = {};
    const uniqueColumns = columns.map((col) => {
      if (seen[col]) {
        seen[col]++;
        return `${col}_${seen[col]}`;
      }
      seen[col] = 1;
      return col;
    });

    const dataRows = rows
      .filter((row) => row.some((cell) => cell.trim() !== ''))
      .map((row) => {
        const obj = {};
        uniqueColumns.forEach((col, i) => {
          obj[col] = row[i] || '';
        });
        return obj;
      });

    if (dataRows.length === 0) return;

    onSave({
      name: name.trim() || 'Untitled',
      columns: uniqueColumns,
      rows: dataRows,
    });
  };

  const nonEmptyRowCount = rows.filter((row) => row.some((cell) => cell.trim() !== '')).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <FormControl>
        <FormControl.Label>Dataset Name</FormControl.Label>
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My dataset"
        />
      </FormControl>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...cellStyle, width: '32px', backgroundColor: 'var(--bgColor-muted, #f6f8fa)' }}></th>
              {headers.map((h, ci) => (
                <th key={ci} style={cellStyle}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      style={headerInputStyle}
                      value={h}
                      onChange={(e) => updateHeader(ci, e.target.value)}
                      placeholder={`column_${ci + 1}`}
                    />
                    {colCount > 1 && (
                      <button
                        onClick={() => removeColumn(ci)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: '12px', color: 'var(--fgColor-danger, #cf222e)' }}
                        title="Remove column"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </th>
              ))}
              {colCount < MAX_COLS && (
                <th style={{ ...cellStyle, width: '32px' }}>
                  <button
                    onClick={addColumn}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', fontSize: '14px', color: 'var(--fgColor-accent, #0969da)' }}
                    title="Add column"
                  >
                    +
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                <td style={{ ...cellStyle, textAlign: 'center', fontSize: '11px', color: 'var(--fgColor-muted, #656d76)', backgroundColor: 'var(--bgColor-muted, #f6f8fa)' }}>
                  {rows.length > 1 ? (
                    <button
                      onClick={() => removeRow(ri)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', fontSize: '11px', color: 'var(--fgColor-danger, #cf222e)' }}
                      title="Remove row"
                    >
                      ✕
                    </button>
                  ) : (
                    <span>{ri + 1}</span>
                  )}
                </td>
                {row.map((cell, ci) => (
                  <td key={ci} style={cellStyle}>
                    <input
                      style={inputStyle}
                      value={cell}
                      onChange={(e) => updateCell(ri, ci, e.target.value)}
                      placeholder="…"
                    />
                  </td>
                ))}
                {colCount < MAX_COLS && <td style={cellStyle}></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <Button size="small" onClick={addRow} disabled={rows.length >= MAX_ROWS}>
          + Add Row
        </Button>
        <Text fontSize={0} color="fg.muted">
          {nonEmptyRowCount} row{nonEmptyRowCount !== 1 ? 's' : ''} · {colCount} column{colCount !== 1 ? 's' : ''} (max {MAX_ROWS} rows, {MAX_COLS} columns)
        </Text>
      </div>

      <div>
        <Button variant="primary" onClick={handleSave} disabled={nonEmptyRowCount === 0}>
          Save Dataset
        </Button>
      </div>
    </div>
  );
}

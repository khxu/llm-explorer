import { describe, it, expect } from 'vitest';
import { formatResultsForExport } from '../utils/export.js';

describe('formatResultsForExport', () => {
  it('pivots results by model into columns', () => {
    const datasetRows = [
      { id: 1, dataset_id: 1, row_index: 0, data: { question: 'What is 2+2?' } },
      { id: 2, dataset_id: 1, row_index: 1, data: { question: 'What is 3+3?' } },
    ];
    const runResults = [
      { dataset_row_id: 1, model: 'gpt-4', output: '4' },
      { dataset_row_id: 1, model: 'claude', output: 'Four' },
      { dataset_row_id: 2, model: 'gpt-4', output: '6' },
      { dataset_row_id: 2, model: 'claude', output: 'Six' },
    ];

    const { columns, rows } = formatResultsForExport(runResults, datasetRows);

    expect(columns).toEqual(['question', 'gpt-4', 'claude']);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ question: 'What is 2+2?', 'gpt-4': '4', claude: 'Four' });
    expect(rows[1]).toEqual({ question: 'What is 3+3?', 'gpt-4': '6', claude: 'Six' });
  });

  it('handles missing results with empty string', () => {
    const datasetRows = [
      { id: 1, dataset_id: 1, row_index: 0, data: { text: 'hello' } },
    ];
    const runResults = [
      { dataset_row_id: 1, model: 'gpt-4', output: 'response' },
      // claude result missing for row 1
      { dataset_row_id: 999, model: 'claude', output: 'orphan' },
    ];

    const { columns, rows } = formatResultsForExport(runResults, datasetRows);

    expect(columns).toEqual(['text', 'gpt-4', 'claude']);
    expect(rows[0]).toEqual({ text: 'hello', 'gpt-4': 'response', claude: '' });
  });

  it('handles empty inputs', () => {
    const { columns, rows } = formatResultsForExport([], []);
    expect(columns).toEqual([]);
    expect(rows).toEqual([]);
  });

  it('handles multiple data columns', () => {
    const datasetRows = [
      { id: 10, dataset_id: 1, row_index: 0, data: { name: 'Alice', age: '30', city: 'NYC' } },
    ];
    const runResults = [
      { dataset_row_id: 10, model: 'model-a', output: 'result-a' },
    ];

    const { columns, rows } = formatResultsForExport(runResults, datasetRows);

    expect(columns).toEqual(['name', 'age', 'city', 'model-a']);
    expect(rows[0]).toEqual({ name: 'Alice', age: '30', city: 'NYC', 'model-a': 'result-a' });
  });

  it('handles results with no dataset rows', () => {
    const runResults = [
      { dataset_row_id: 1, model: 'gpt-4', output: 'hi' },
    ];
    const { columns, rows } = formatResultsForExport(runResults, []);
    expect(columns).toEqual(['gpt-4']);
    expect(rows).toEqual([]);
  });
});

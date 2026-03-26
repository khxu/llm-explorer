import { interpolate } from './template.js';

/**
 * Generate JSONL content for OpenAI's Batch API from an experiment and dataset rows.
 * Each line is a JSON object: { custom_id, method, url, body }.
 */
export function generateBatchJSONL({ experiment, datasetRows, model }) {
  const lines = datasetRows.map((row, i) => {
    const messages = [];

    const systemContent = interpolate(experiment.system_prompt || '', row.data);
    if (systemContent) {
      messages.push({ role: 'system', content: systemContent });
    }

    const userContent = interpolate(experiment.user_prompt || '', row.data);
    if (userContent) {
      messages.push({ role: 'user', content: userContent });
    }

    const body = {
      model,
      messages,
      temperature: experiment.temperature ?? 1.0,
      max_completion_tokens: experiment.max_tokens ?? 1024,
    };

    return JSON.stringify({
      custom_id: `row-${i}`,
      method: 'POST',
      url: '/v1/chat/completions',
      body,
    });
  });

  return lines.join('\n');
}

export function downloadJSONL(filename, content) {
  const blob = new Blob([content], { type: 'application/jsonl' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

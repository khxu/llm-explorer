import { database, checkpoint } from './connection.js';

// --- API Keys ---

export async function saveApiKey(provider, apiKey, baseUrl = null) {
  const stmt = database.prepare(
    `INSERT INTO api_keys (provider, api_key, base_url) VALUES (?, ?, ?)
     ON CONFLICT(provider) DO UPDATE SET api_key = excluded.api_key, base_url = excluded.base_url`
  );
  await stmt.run(provider, apiKey, baseUrl);
  await checkpoint();
}

export async function getApiKey(provider) {
  const rows = await database.prepare(
    'SELECT * FROM api_keys WHERE provider = ?'
  ).all(provider);
  return rows[0] || null;
}

export async function getAllApiKeys() {
  return database.prepare('SELECT * FROM api_keys').all();
}

export async function deleteApiKey(provider) {
  await database.prepare('DELETE FROM api_keys WHERE provider = ?').run(provider);
  await checkpoint();
}

// --- Datasets ---

export async function createDataset(name, columns, rowCount) {
  const result = await database.prepare(
    'INSERT INTO datasets (name, columns, row_count) VALUES (?, ?, ?)'
  ).run(name, JSON.stringify(columns), rowCount);
  await checkpoint();
  return result.lastInsertRowid;
}

export async function getAllDatasets() {
  const rows = await database.prepare('SELECT * FROM datasets').all();
  return rows.map(row => ({ ...row, columns: JSON.parse(row.columns) }));
}

export async function getDataset(id) {
  const rows = await database.prepare('SELECT * FROM datasets WHERE id = ?').all(id);
  if (!rows[0]) return null;
  return { ...rows[0], columns: JSON.parse(rows[0].columns) };
}

export async function deleteDataset(id) {
  await database.prepare('DELETE FROM dataset_rows WHERE dataset_id = ?').run(id);
  await database.prepare('DELETE FROM datasets WHERE id = ?').run(id);
  await checkpoint();
}

// --- Dataset Rows ---

export async function insertDatasetRows(datasetId, rows) {
  const stmt = database.prepare(
    'INSERT INTO dataset_rows (dataset_id, row_index, data) VALUES (?, ?, ?)'
  );
  for (const row of rows) {
    await stmt.run(datasetId, row.rowIndex, JSON.stringify(row.data));
  }
  await checkpoint();
}

export async function getDatasetRows(datasetId) {
  const rows = await database.prepare(
    'SELECT * FROM dataset_rows WHERE dataset_id = ? ORDER BY row_index'
  ).all(datasetId);
  return rows.map(row => ({ ...row, data: JSON.parse(row.data) }));
}

export async function getDatasetRow(id) {
  const rows = await database.prepare(
    'SELECT * FROM dataset_rows WHERE id = ?'
  ).all(id);
  if (!rows[0]) return null;
  return { ...rows[0], data: JSON.parse(rows[0].data) };
}

// --- Experiments ---

export async function createExperiment({ name, datasetId, systemPrompt, userPrompt, models, temperature, maxTokens, extraParams }) {
  const result = await database.prepare(
    `INSERT INTO experiments (name, dataset_id, system_prompt, user_prompt, models, temperature, max_tokens, extra_params)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    name,
    datasetId || null,
    systemPrompt || null,
    userPrompt || null,
    JSON.stringify(models),
    temperature ?? 1.0,
    maxTokens ?? 1024,
    extraParams ? JSON.stringify(extraParams) : null
  );
  await checkpoint();
  return result.lastInsertRowid;
}

export async function getAllExperiments() {
  const rows = await database.prepare('SELECT * FROM experiments').all();
  return rows.map(parseExperimentRow);
}

export async function getExperiment(id) {
  const rows = await database.prepare('SELECT * FROM experiments WHERE id = ?').all(id);
  if (!rows[0]) return null;
  return parseExperimentRow(rows[0]);
}

export async function updateExperiment(id, updates) {
  const allowed = ['name', 'dataset_id', 'system_prompt', 'user_prompt', 'models', 'temperature', 'max_tokens', 'extra_params']; // eslint-disable-line no-unused-vars
  const fieldMap = {
    name: 'name',
    datasetId: 'dataset_id',
    systemPrompt: 'system_prompt',
    userPrompt: 'user_prompt',
    models: 'models',
    temperature: 'temperature',
    maxTokens: 'max_tokens',
    extraParams: 'extra_params',
  };

  const setClauses = [];
  const values = [];

  for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
    if (jsKey in updates) {
      setClauses.push(`${dbCol} = ?`);
      const val = updates[jsKey];
      if (jsKey === 'models' || jsKey === 'extraParams') {
        values.push(val != null ? JSON.stringify(val) : null);
      } else {
        values.push(val ?? null);
      }
    }
  }

  if (setClauses.length === 0) return;

  setClauses.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  await database.prepare(
    `UPDATE experiments SET ${setClauses.join(', ')} WHERE id = ?`
  ).run(...values);
  await checkpoint();
}

export async function deleteExperiment(id) {
  await database.prepare('DELETE FROM run_results WHERE experiment_id = ?').run(id);
  await database.prepare('DELETE FROM experiments WHERE id = ?').run(id);
  await checkpoint();
}

function parseExperimentRow(row) {
  return {
    ...row,
    models: JSON.parse(row.models),
    extra_params: row.extra_params ? JSON.parse(row.extra_params) : null,
  };
}

// --- Run Results ---

export async function createRunResult({ experimentId, datasetRowId, model, provider, status, inputSystem, inputUser }) {
  const result = await database.prepare(
    `INSERT INTO run_results (experiment_id, dataset_row_id, model, provider, status, input_system, input_user)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    experimentId,
    datasetRowId || null,
    model,
    provider,
    status || 'pending',
    inputSystem || null,
    inputUser || null
  );
  await checkpoint();
  return result.lastInsertRowid;
}

export async function updateRunResult(id, updates) {
  const fieldMap = {
    status: 'status',
    output: 'output',
    error: 'error',
    tokensInput: 'tokens_input',
    tokensOutput: 'tokens_output',
    latencyMs: 'latency_ms',
  };

  const setClauses = [];
  const values = [];

  for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
    if (jsKey in updates) {
      setClauses.push(`${dbCol} = ?`);
      values.push(updates[jsKey] ?? null);
    }
  }

  if (setClauses.length === 0) return;

  values.push(id);

  await database.prepare(
    `UPDATE run_results SET ${setClauses.join(', ')} WHERE id = ?`
  ).run(...values);
  await checkpoint();
}

export async function getRunResults(experimentId) {
  return database.prepare(
    'SELECT * FROM run_results WHERE experiment_id = ? ORDER BY id'
  ).all(experimentId);
}

export async function getRunResult(id) {
  const rows = await database.prepare(
    'SELECT * FROM run_results WHERE id = ?'
  ).all(id);
  return rows[0] || null;
}

// --- Logs ---

export async function addLog({ experimentId, runResultId, level, message, metadata }) {
  await database.prepare(
    `INSERT INTO logs (experiment_id, run_result_id, level, message, metadata)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    experimentId || null,
    runResultId || null,
    level || 'info',
    message,
    metadata ? JSON.stringify(metadata) : null
  );
  await checkpoint();
}

export async function getLogs({ experimentId, level, limit } = {}) {
  let sql = 'SELECT * FROM logs WHERE 1=1';
  const params = [];

  if (experimentId != null) {
    sql += ' AND experiment_id = ?';
    params.push(experimentId);
  }
  if (level) {
    sql += ' AND level = ?';
    params.push(level);
  }

  sql += ' ORDER BY created_at DESC';

  if (limit) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  const rows = await database.prepare(sql).all(...params);
  return rows.map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  }));
}

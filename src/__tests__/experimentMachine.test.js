import { describe, it, expect, vi } from 'vitest';

// Mock the DB and provider modules that the machine imports
vi.mock('../db/queries.js', () => ({
  createRunResult: vi.fn().mockResolvedValue(1),
  updateRunResult: vi.fn().mockResolvedValue(),
  addLog: vi.fn().mockResolvedValue(),
}));
vi.mock('../providers/index.js', () => ({
  createProvider: vi.fn(),
}));

import { createActor } from 'xstate';
import { experimentMachine } from '../machines/experimentMachine.js';

describe('experimentMachine', () => {
  it('starts in idle state', () => {
    const actor = createActor(experimentMachine);
    actor.start();
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('has correct initial context', () => {
    const actor = createActor(experimentMachine);
    actor.start();
    const ctx = actor.getSnapshot().context;
    expect(ctx.experiment).toBeNull();
    expect(ctx.datasetRows).toEqual([]);
    expect(ctx.results).toEqual([]);
    expect(ctx.progress).toEqual({ total: 0, completed: 0, failed: 0 });
    expect(ctx.error).toBeNull();
    expect(ctx.cancelled).toBe(false);
    actor.stop();
  });

  it('transitions to executing on START and sets context', () => {
    const actor = createActor(experimentMachine);
    actor.start();

    const experiment = {
      id: 1,
      models: ['model-a', 'model-b'],
      system_prompt: 'You are helpful',
      user_prompt: 'Hello {{name}}',
      temperature: 0.5,
      max_tokens: 100,
    };
    const datasetRows = [
      { id: 1, row_index: 0, data: { name: 'Alice' } },
      { id: 2, row_index: 1, data: { name: 'Bob' } },
    ];

    actor.send({
      type: 'START',
      experiment,
      datasetRows,
      provider: 'openrouter',
      apiKey: 'test-key',
    });

    const snap = actor.getSnapshot();
    expect(snap.value).toBe('executing');
    expect(snap.context.experiment).toBe(experiment);
    expect(snap.context.datasetRows).toBe(datasetRows);
    expect(snap.context.provider).toBe('openrouter');
    expect(snap.context.apiKey).toBe('test-key');
    expect(snap.context.progress.total).toBe(4); // 2 rows × 2 models
    expect(snap.context.progress.completed).toBe(0);
    actor.stop();
  });

  it('ignores START when not in idle', () => {
    const actor = createActor(experimentMachine);
    actor.start();

    // First START to go to executing
    actor.send({
      type: 'START',
      experiment: { id: 1, models: ['m'], system_prompt: null, user_prompt: 'hi', temperature: 1, max_tokens: 10 },
      datasetRows: [{ id: 1, row_index: 0, data: {} }],
      provider: 'openrouter',
      apiKey: 'key',
    });
    expect(actor.getSnapshot().value).toBe('executing');

    // Second START should be ignored (still in executing)
    actor.send({
      type: 'START',
      experiment: { id: 2, models: ['m2'], system_prompt: null, user_prompt: 'hi2', temperature: 1, max_tokens: 10 },
      datasetRows: [],
      provider: 'openai',
      apiKey: 'key2',
    });
    expect(actor.getSnapshot().context.experiment.id).toBe(1);
    actor.stop();
  });

  it('tracks RUN_COMPLETE progress in executing state', () => {
    const actor = createActor(experimentMachine);
    actor.start();

    actor.send({
      type: 'START',
      experiment: { id: 1, models: ['m1'], system_prompt: null, user_prompt: 'hi', temperature: 1, max_tokens: 10 },
      datasetRows: [{ id: 1, row_index: 0, data: {} }],
      provider: 'openrouter',
      apiKey: 'key',
    });

    actor.send({
      type: 'RUN_COMPLETE',
      resultId: 1,
      model: 'm1',
      rowIndex: 0,
      output: 'hello',
      tokensInput: 5,
      tokensOutput: 3,
      latencyMs: 100,
    });

    const ctx = actor.getSnapshot().context;
    expect(ctx.progress.completed).toBe(1);
    expect(ctx.progress.failed).toBe(0);
    expect(ctx.results).toHaveLength(1);
    expect(ctx.results[0].output).toBe('hello');
    actor.stop();
  });

  it('tracks RUN_ERROR in executing state', () => {
    const actor = createActor(experimentMachine);
    actor.start();

    actor.send({
      type: 'START',
      experiment: { id: 1, models: ['m1'], system_prompt: null, user_prompt: 'hi', temperature: 1, max_tokens: 10 },
      datasetRows: [{ id: 1, row_index: 0, data: {} }],
      provider: 'openrouter',
      apiKey: 'key',
    });

    actor.send({
      type: 'RUN_ERROR',
      resultId: 1,
      model: 'm1',
      rowIndex: 0,
      error: 'Rate limit exceeded',
    });

    const ctx = actor.getSnapshot().context;
    expect(ctx.progress.completed).toBe(1);
    expect(ctx.progress.failed).toBe(1);
    expect(ctx.results[0].error).toBe('Rate limit exceeded');
    actor.stop();
  });

  it('transitions to completed on BATCH_DONE', () => {
    const actor = createActor(experimentMachine);
    actor.start();

    actor.send({
      type: 'START',
      experiment: { id: 1, models: ['m1'], system_prompt: null, user_prompt: 'hi', temperature: 1, max_tokens: 10 },
      datasetRows: [{ id: 1, row_index: 0, data: {} }],
      provider: 'openrouter',
      apiKey: 'key',
    });

    actor.send({ type: 'BATCH_DONE' });
    expect(actor.getSnapshot().value).toBe('completed');
    actor.stop();
  });

  it('returns to idle on CANCEL during executing', () => {
    const actor = createActor(experimentMachine);
    actor.start();

    actor.send({
      type: 'START',
      experiment: { id: 1, models: ['m1'], system_prompt: null, user_prompt: 'hi', temperature: 1, max_tokens: 10 },
      datasetRows: [{ id: 1, row_index: 0, data: {} }],
      provider: 'openrouter',
      apiKey: 'key',
    });

    actor.send({ type: 'CANCEL' });
    const snap = actor.getSnapshot();
    expect(snap.value).toBe('idle');
    expect(snap.context.cancelled).toBe(true);
    actor.stop();
  });

  it('resets context on RESET from completed', () => {
    const actor = createActor(experimentMachine);
    actor.start();

    actor.send({
      type: 'START',
      experiment: { id: 1, models: ['m1'], system_prompt: null, user_prompt: 'hi', temperature: 1, max_tokens: 10 },
      datasetRows: [{ id: 1, row_index: 0, data: {} }],
      provider: 'openrouter',
      apiKey: 'key',
    });
    actor.send({ type: 'BATCH_DONE' });
    expect(actor.getSnapshot().value).toBe('completed');

    actor.send({ type: 'RESET' });
    const snap = actor.getSnapshot();
    expect(snap.value).toBe('idle');
    expect(snap.context.experiment).toBeNull();
    expect(snap.context.results).toEqual([]);
    expect(snap.context.progress).toEqual({ total: 0, completed: 0, failed: 0 });
    actor.stop();
  });
});

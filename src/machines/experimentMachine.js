import { setup, assign, fromCallback } from 'xstate';
import {
  createRunResult,
  updateRunResult,
  deleteRunResults,
  addLog,
  updateExecutionStatus,
  deleteExecutionState,
} from '../db/queries.js';
import { createProvider } from '../providers/index.js';
import { interpolate } from '../utils/template.js';

const executionActor = fromCallback(({ sendBack, input }) => {
  let cancelled = false;

  async function run() {
    const { experiment, datasetRows, provider, apiKey, completedResults, deleteResultIds, runId } = input;
    const providerInstance = createProvider(provider, apiKey);
    const models = experiment.models;

    // Delete old error results before retrying
    if (deleteResultIds?.length) {
      await deleteRunResults(deleteResultIds);
    }

    // Build set of already-completed pairs to skip
    const skipPairs = new Set();
    if (completedResults?.length) {
      for (const r of completedResults) {
        skipPairs.add(`${r.rowIndex}:${r.model}`);
      }
    }

    for (const row of datasetRows) {
      for (const model of models) {
        if (cancelled) {
          sendBack({ type: 'CANCELLED' });
          return;
        }

        if (skipPairs.has(`${row.row_index}:${model}`)) continue;

        const inputSystem = experiment.system_prompt
          ? interpolate(experiment.system_prompt, row.data)
          : null;
        const inputUser = experiment.user_prompt
          ? interpolate(experiment.user_prompt, row.data)
          : null;

        const resultId = await createRunResult({
          experimentId: experiment.id,
          datasetRowId: row.id,
          model,
          provider,
          status: 'running',
          inputSystem,
          inputUser,
          runId,
        });

        try {
          const messages = [];
          if (inputSystem) messages.push({ role: 'system', content: inputSystem });
          if (inputUser) messages.push({ role: 'user', content: inputUser });

          const response = await providerInstance.chatCompletion({
            model,
            messages,
            temperature: experiment.temperature,
            maxTokens: experiment.max_tokens,
          });

          await updateRunResult(resultId, {
            status: 'success',
            output: response.content,
            tokensInput: response.tokensInput,
            tokensOutput: response.tokensOutput,
            latencyMs: Math.round(response.latencyMs),
          });

          sendBack({
            type: 'RUN_COMPLETE',
            resultId,
            model,
            rowIndex: row.row_index,
            output: response.content,
            tokensInput: response.tokensInput,
            tokensOutput: response.tokensOutput,
            latencyMs: Math.round(response.latencyMs),
          });
        } catch (err) {
          await updateRunResult(resultId, {
            status: 'error',
            error: err.message,
          });

          sendBack({
            type: 'RUN_ERROR',
            resultId,
            model,
            rowIndex: row.row_index,
            error: err.message,
          });
        }

        await addLog({
          experimentId: experiment.id,
          runResultId: resultId,
          level: 'info',
          message: `Completed ${model} for row ${row.row_index}`,
        });
      }
    }

    sendBack({ type: 'BATCH_DONE' });
  }

  run();

  return () => {
    cancelled = true;
  };
});

// Shared action: keep only successes, queue error result IDs for deletion
const prepareRetry = assign(({ context }) => {
  const errorResults = context.results.filter(r => r.type === 'RUN_ERROR');
  const successResults = context.results.filter(r => r.type !== 'RUN_ERROR');
  return {
    results: successResults,
    deleteResultIds: errorResults.map(r => r.resultId).filter(Boolean),
    progress: {
      total: context.progress.total,
      completed: successResults.length,
      failed: 0,
    },
    cancelled: false,
  };
});

// Persistence helpers (fire-and-forget with error logging)
const persistStatus = (status) => ({ context }) => {
  if (context.runId) updateExecutionStatus(context.runId, status).catch(() => {});
};
const persistDelete = ({ context }) => {
  if (context.runId) deleteExecutionState(context.runId).catch(() => {});
};

// Shared assign for RESTORE event
const restoreAssign = assign(({ event }) => ({
  experiment: event.experiment,
  datasetRows: event.datasetRows,
  models: event.experiment.models,
  provider: event.provider,
  apiKey: event.apiKey,
  results: event.results,
  progress: event.progress,
  runId: event.runId,
  error: null,
  cancelled: false,
  deleteResultIds: [],
}));

export const experimentMachine = setup({
  actors: { executionActor },
}).createMachine({
  id: 'experiment',
  initial: 'idle',
  context: {
    experiment: null,
    datasetRows: [],
    models: [],
    provider: null,
    apiKey: null,
    results: [],
    progress: { total: 0, completed: 0, failed: 0 },
    error: null,
    cancelled: false,
    deleteResultIds: [],
    runId: null,
  },
  states: {
    idle: {
      on: {
        START: {
          target: 'executing',
          actions: assign(({ event }) => ({
            experiment: event.experiment,
            datasetRows: event.datasetRows,
            models: event.experiment.models,
            provider: event.provider,
            apiKey: event.apiKey,
            results: [],
            progress: {
              total: event.datasetRows.length * event.experiment.models.length,
              completed: 0,
              failed: 0,
            },
            error: null,
            cancelled: false,
            deleteResultIds: [],
            runId: event.runId,
          })),
        },
        RESTORE: [
          {
            guard: ({ event }) => event.status === 'completed',
            target: 'completed',
            actions: restoreAssign,
          },
          {
            target: 'paused',
            actions: restoreAssign,
          },
        ],
      },
    },
    executing: {
      invoke: {
        src: 'executionActor',
        input: ({ context }) => ({
          experiment: context.experiment,
          datasetRows: context.datasetRows,
          provider: context.provider,
          apiKey: context.apiKey,
          completedResults: context.results,
          deleteResultIds: context.deleteResultIds,
          runId: context.runId,
        }),
      },
      on: {
        RUN_COMPLETE: {
          actions: assign(({ context, event }) => ({
            results: [...context.results, event],
            progress: {
              ...context.progress,
              completed: context.progress.completed + 1,
            },
          })),
        },
        RUN_ERROR: {
          actions: assign(({ context, event }) => ({
            results: [...context.results, event],
            progress: {
              ...context.progress,
              completed: context.progress.completed + 1,
              failed: context.progress.failed + 1,
            },
          })),
        },
        BATCH_DONE: {
          target: 'completed',
          actions: persistStatus('completed'),
        },
        CANCELLED: {
          target: 'idle',
          actions: [assign({ cancelled: true }), persistDelete],
        },
        CANCEL: {
          target: 'idle',
          actions: [assign({ cancelled: true }), persistDelete],
        },
        PAUSE: {
          target: 'paused',
          actions: persistStatus('paused'),
        },
      },
    },
    paused: {
      on: {
        // Handle straggling events from the just-stopped actor
        RUN_COMPLETE: {
          actions: assign(({ context, event }) => ({
            results: [...context.results, event],
            progress: {
              ...context.progress,
              completed: context.progress.completed + 1,
            },
          })),
        },
        RUN_ERROR: {
          actions: assign(({ context, event }) => ({
            results: [...context.results, event],
            progress: {
              ...context.progress,
              completed: context.progress.completed + 1,
              failed: context.progress.failed + 1,
            },
          })),
        },
        BATCH_DONE: {
          target: 'completed',
          actions: persistStatus('completed'),
        },
        RESUME: {
          target: 'executing',
          actions: [prepareRetry, persistStatus('running')],
        },
        CANCEL: {
          target: 'idle',
          actions: [assign({ cancelled: true }), persistDelete],
        },
      },
    },
    completed: {
      on: {
        RETRY_FAILED: {
          target: 'executing',
          actions: [prepareRetry, persistStatus('running')],
        },
        RESET: {
          target: 'idle',
          actions: [
            assign({
              experiment: null,
              datasetRows: [],
              models: [],
              results: [],
              progress: { total: 0, completed: 0, failed: 0 },
              error: null,
              deleteResultIds: [],
              runId: null,
            }),
            persistDelete,
          ],
        },
      },
    },
    error: {
      on: {
        RESET: {
          target: 'idle',
          actions: [
            assign({
              experiment: null,
              datasetRows: [],
              models: [],
              results: [],
              progress: { total: 0, completed: 0, failed: 0 },
              error: null,
              deleteResultIds: [],
              runId: null,
            }),
            persistDelete,
          ],
        },
      },
    },
  },
});

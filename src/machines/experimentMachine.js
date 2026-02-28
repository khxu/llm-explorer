import { setup, assign, fromCallback } from 'xstate';
import {
  createRunResult,
  updateRunResult,
  addLog,
} from '../db/queries.js';
import { createProvider } from '../providers/index.js';
import { interpolate } from '../utils/template.js';

const executionActor = fromCallback(({ sendBack, input }) => {
  let cancelled = false;

  async function run() {
    const { experiment, datasetRows, provider, apiKey } = input;
    const providerInstance = createProvider(provider, apiKey);
    const models = experiment.models;

    for (const row of datasetRows) {
      for (const model of models) {
        if (cancelled) {
          sendBack({ type: 'CANCELLED' });
          return;
        }

        const inputSystem = experiment.system_prompt
          ? interpolate(experiment.system_prompt, row.data)
          : null;
        const inputUser = interpolate(experiment.user_prompt, row.data);

        const resultId = await createRunResult({
          experimentId: experiment.id,
          datasetRowId: row.id,
          model,
          provider,
          status: 'running',
          inputSystem,
          inputUser,
        });

        try {
          const messages = [];
          if (inputSystem) messages.push({ role: 'system', content: inputSystem });
          messages.push({ role: 'user', content: inputUser });

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
          })),
        },
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
        BATCH_DONE: { target: 'completed' },
        CANCELLED: {
          target: 'idle',
          actions: assign({ cancelled: true }),
        },
        CANCEL: {
          target: 'idle',
          actions: assign({ cancelled: true }),
        },
      },
    },
    completed: {
      on: {
        RESET: {
          target: 'idle',
          actions: assign({
            experiment: null,
            datasetRows: [],
            models: [],
            results: [],
            progress: { total: 0, completed: 0, failed: 0 },
            error: null,
          }),
        },
      },
    },
    error: {
      on: {
        RESET: {
          target: 'idle',
          actions: assign({
            experiment: null,
            datasetRows: [],
            models: [],
            results: [],
            progress: { total: 0, completed: 0, failed: 0 },
            error: null,
          }),
        },
      },
    },
  },
});

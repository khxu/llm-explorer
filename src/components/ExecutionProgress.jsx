import { Button, Text, Flash } from '@primer/react';

function ProgressBar({ value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div
      style={{
        width: '100%',
        height: 8,
        borderRadius: 4,
        backgroundColor: 'var(--bgColor-neutral-muted, #d0d7de)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: 4,
          backgroundColor: 'var(--fgColor-success, #1a7f37)',
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}

function ResultRow({ result }) {
  const isError = result.type === 'RUN_ERROR';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 0',
        borderBottom: '1px solid var(--borderColor-muted, #d8dee4)',
        fontSize: 13,
      }}
    >
      <Text fontSize={0}>
        Row {result.rowIndex} · <strong>{result.model}</strong>
      </Text>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isError ? (
          <Text fontSize={0} color="danger.fg">✗ error</Text>
        ) : (
          <>
            <Text fontSize={0} color="success.fg">✓ success</Text>
            <Text fontSize={0} color="fg.muted">{result.latencyMs}ms</Text>
          </>
        )}
      </span>
    </div>
  );
}

export default function ExecutionProgress({ state, send }) {
  const stateName = typeof state.value === 'string' ? state.value : Object.keys(state.value)[0];
  const { progress, results, error } = state.context;

  if (stateName === 'idle') {
    return (
      <div style={{ padding: '16px 0' }}>
        <Text color="fg.muted">Ready to run an experiment.</Text>
      </div>
    );
  }

  if (stateName === 'error') {
    return (
      <div style={{ padding: '16px 0' }}>
        <Flash variant="danger" sx={{ mb: 3 }}>
          {error || 'An unexpected error occurred.'}
        </Flash>
        <Button onClick={() => send({ type: 'RESET' })}>Reset</Button>
      </div>
    );
  }

  if (stateName === 'completed') {
    const { completed, failed } = progress;
    return (
      <div style={{ padding: '16px 0' }}>
        <Flash variant="success" sx={{ mb: 3 }}>
          Experiment complete — {completed} run{completed !== 1 ? 's' : ''} finished
          {failed > 0 ? ` (${failed} failed)` : ''}.
        </Flash>
        <Button onClick={() => send({ type: 'RESET' })}>Reset</Button>
      </div>
    );
  }

  // executing state
  const { total, completed, failed } = progress;
  const remaining = total - completed;
  const recentResults = results.slice(-10);

  return (
    <div style={{ padding: '16px 0' }}>
      <Text fontWeight="bold" sx={{ mb: 2, display: 'block' }}>
        Running experiment… {completed} / {total}
      </Text>

      <ProgressBar value={completed} max={total} />

      <div
        style={{
          display: 'flex',
          gap: 16,
          marginTop: 8,
          marginBottom: 12,
          fontSize: 13,
        }}
      >
        <Text fontSize={0} color="fg.muted">Completed: {completed}</Text>
        <Text fontSize={0} color="danger.fg">Failed: {failed}</Text>
        <Text fontSize={0} color="fg.muted">Remaining: {remaining}</Text>
      </div>

      {recentResults.length > 0 && (
        <div
          style={{
            maxHeight: 240,
            overflowY: 'auto',
            border: '1px solid var(--borderColor-default, #d0d7de)',
            borderRadius: 6,
            padding: 8,
            marginBottom: 16,
          }}
        >
          <Text fontWeight="bold" fontSize={0} sx={{ mb: 1, display: 'block' }}>
            Recent results
          </Text>
          {recentResults.map((r, i) => (
            <ResultRow key={r.resultId ?? i} result={r} />
          ))}
        </div>
      )}

      <Button variant="danger" onClick={() => send({ type: 'CANCEL' })}>
        Cancel
      </Button>
    </div>
  );
}

import { useState } from 'react';
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

function ResultRow({ result, isExpanded, onToggle }) {
  const isError = result.type === 'RUN_ERROR';
  return (
    <div style={{ borderBottom: '1px solid var(--borderColor-muted, #d8dee4)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 0',
          fontSize: 13,
          cursor: 'pointer',
        }}
        onClick={onToggle}
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
          <Text fontSize={0} color="fg.muted">{isExpanded ? '▾' : '▸'}</Text>
        </span>
      </div>
      {isExpanded && (
        <div
          style={{
            padding: '6px 8px 10px',
            fontSize: 12,
            backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
            borderRadius: 4,
            marginBottom: 4,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 200,
            overflowY: 'auto',
          }}
        >
          {isError ? (
            <Text color="danger.fg">{result.error}</Text>
          ) : (
            <Text>{result.output}</Text>
          )}
          {!isError && result.tokensInput != null && (
            <div style={{ marginTop: 4, color: 'var(--fgColor-muted, #656d76)' }}>
              Tokens: {result.tokensInput} in / {result.tokensOutput} out
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ExecutionProgress({ state, send }) {
  const [expandedId, setExpandedId] = useState(null);
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
        {results.length > 0 && (
          <ResultsList results={results} expandedId={expandedId} setExpandedId={setExpandedId} />
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {failed > 0 && (
            <Button variant="primary" onClick={() => send({ type: 'RETRY_FAILED' })}>
              Retry Failed ({failed})
            </Button>
          )}
          <Button onClick={() => send({ type: 'RESET' })}>Reset</Button>
        </div>
      </div>
    );
  }

  if (stateName === 'paused') {
    const { total, completed, failed } = progress;
    const remaining = total - completed;
    return (
      <div style={{ padding: '16px 0' }}>
        <Flash variant="warning" sx={{ mb: 3 }}>
          Experiment paused — {completed} / {total} completed
          {failed > 0 ? ` (${failed} failed)` : ''}.
        </Flash>

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

        {results.length > 0 && (
          <ResultsList results={results} expandedId={expandedId} setExpandedId={setExpandedId} />
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button variant="primary" onClick={() => send({ type: 'RESUME' })}>
            Resume
          </Button>
          <Button variant="danger" onClick={() => send({ type: 'CANCEL' })}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // executing state
  const { total, completed, failed } = progress;
  const remaining = total - completed;

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

      {results.length > 0 && (
        <ResultsList results={results} expandedId={expandedId} setExpandedId={setExpandedId} />
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Button onClick={() => send({ type: 'PAUSE' })}>
          Pause
        </Button>
        <Button variant="danger" onClick={() => send({ type: 'CANCEL' })}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ResultsList({ results, expandedId, setExpandedId }) {
  // Show most recent first
  const displayed = [...results].reverse();
  return (
    <div
      style={{
        maxHeight: 400,
        overflowY: 'auto',
        border: '1px solid var(--borderColor-default, #d0d7de)',
        borderRadius: 6,
        padding: 8,
        marginBottom: 8,
      }}
    >
      <Text fontWeight="bold" fontSize={0} sx={{ mb: 1, display: 'block' }}>
        Results ({results.length})
      </Text>
      {displayed.map((r, i) => (
        <ResultRow
          key={r.resultId ?? i}
          result={r}
          isExpanded={expandedId === (r.resultId ?? i)}
          onToggle={() =>
            setExpandedId(expandedId === (r.resultId ?? i) ? null : (r.resultId ?? i))
          }
        />
      ))}
    </div>
  );
}

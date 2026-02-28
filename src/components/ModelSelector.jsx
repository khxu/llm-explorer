import { useState, useEffect, useMemo } from 'react';
import { TextInput, ActionList, Text, Spinner, Flash } from '@primer/react';
import { createProvider } from '../providers/index.js';

export default function ModelSelector({ selectedModels = [], onChange, provider, apiKey }) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!provider || !apiKey) {
      setModels([]); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    createProvider(provider, apiKey)
      .listModels()
      .then((list) => {
        if (!cancelled) setModels(list || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to fetch models');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [provider, apiKey]);

  const filtered = useMemo(() => {
    if (!search) return models;
    const q = search.toLowerCase();
    return models.filter((m) => {
      const id = typeof m === 'string' ? m : m.id || m.name || '';
      return id.toLowerCase().includes(q);
    });
  }, [models, search]);

  const getModelId = (m) => (typeof m === 'string' ? m : m.id || m.name);

  const toggleModel = (modelId) => {
    if (selectedModels.includes(modelId)) {
      onChange(selectedModels.filter((id) => id !== modelId));
    } else {
      onChange([...selectedModels, modelId]);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0' }}>
        <Spinner size="small" />
        <Text>Loading models…</Text>
      </div>
    );
  }

  if (error) {
    return <Flash variant="danger">{error}</Flash>;
  }

  return (
    <div>
      <Text as="p" fontSize={1} color="fg.muted" style={{ marginBottom: '8px' }}>
        {selectedModels.length} model{selectedModels.length !== 1 ? 's' : ''} selected
      </Text>
      <TextInput
        placeholder="Filter models…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        block
        style={{ marginBottom: '8px' }}
      />
      <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--borderColor-default, #d0d7de)', borderRadius: '6px' }}>
        <ActionList selectionVariant="multiple">
          {filtered.map((m) => {
            const id = getModelId(m);
            const selected = selectedModels.includes(id);
            return (
              <ActionList.Item
                key={id}
                selected={selected}
                onSelect={() => toggleModel(id)}
              >
                {id}
              </ActionList.Item>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: '12px' }}>
              <Text color="fg.muted">No models found</Text>
            </div>
          )}
        </ActionList>
      </div>
    </div>
  );
}

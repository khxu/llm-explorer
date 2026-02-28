import { useState, useEffect, useCallback } from 'react';
import { Button, TextInput, FormControl, Flash, Text } from '@primer/react';
import { saveApiKey, getAllApiKeys, deleteApiKey } from '../db/queries.js';
import { PROVIDER_NAMES } from '../providers/index.js';

function SettingsPanel() {
  const [keys, setKeys] = useState({});
  const [formState, setFormState] = useState({});
  const [visibility, setVisibility] = useState({});
  const [flash, setFlash] = useState(null);

  const loadKeys = useCallback(async () => {
    const allKeys = await getAllApiKeys();
    const keyMap = {};
    const formMap = {};
    for (const row of allKeys) {
      keyMap[row.provider] = row;
      formMap[row.provider] = { apiKey: row.api_key, baseUrl: row.base_url || '' };
    }
    for (const p of PROVIDER_NAMES) {
      if (!formMap[p]) formMap[p] = { apiKey: '', baseUrl: '' };
    }
    setKeys(keyMap);
    setFormState(formMap);
  }, []);

  useEffect(() => {
    loadKeys(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadKeys]);

  function updateField(provider, field, value) {
    setFormState(prev => ({
      ...prev,
      [provider]: { ...prev[provider], [field]: value },
    }));
  }

  function showFlash(variant, message) {
    setFlash({ variant, message });
    setTimeout(() => setFlash(null), 3000);
  }

  async function handleSave(provider) {
    const { apiKey, baseUrl } = formState[provider];
    if (!apiKey.trim()) {
      showFlash('danger', `API key for ${provider} cannot be empty.`);
      return;
    }
    try {
      await saveApiKey(provider, apiKey.trim(), baseUrl.trim() || null);
      await loadKeys();
      showFlash('success', `API key for ${provider} saved.`);
    } catch (err) {
      showFlash('danger', `Error saving key: ${err.message}`);
    }
  }

  async function handleDelete(provider) {
    try {
      await deleteApiKey(provider);
      await loadKeys();
      showFlash('success', `API key for ${provider} deleted.`);
    } catch (err) {
      showFlash('danger', `Error deleting key: ${err.message}`);
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: '16px' }}>API Keys</h2>
      {flash && (
        <Flash variant={flash.variant} sx={{ mb: 3 }}>
          {flash.message}
        </Flash>
      )}
      {PROVIDER_NAMES.map(provider => {
        const form = formState[provider] || { apiKey: '', baseUrl: '' };
        const exists = !!keys[provider];
        const visible = visibility[provider];

        return (
          <div key={provider} style={{ marginBottom: '24px', padding: '16px', border: '1px solid var(--borderColor-default, #d0d7de)', borderRadius: '6px' }}>
            <h3 style={{ marginBottom: '12px', textTransform: 'capitalize' }}>
              {provider}
            </h3>
            <FormControl sx={{ mb: 2 }}>
              <FormControl.Label>API Key</FormControl.Label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <TextInput
                  type={visible ? 'text' : 'password'}
                  value={form.apiKey}
                  onChange={(e) => updateField(provider, 'apiKey', e.target.value)}
                  placeholder="Enter API key"
                  sx={{ flex: 1 }}
                />
                <Button
                  size="small"
                  onClick={() => setVisibility(prev => ({ ...prev, [provider]: !prev[provider] }))}
                >
                  {visible ? 'Hide' : 'Show'}
                </Button>
              </div>
            </FormControl>
            <FormControl sx={{ mb: 2 }}>
              <FormControl.Label>Base URL (optional)</FormControl.Label>
              <TextInput
                value={form.baseUrl}
                onChange={(e) => updateField(provider, 'baseUrl', e.target.value)}
                placeholder="https://api.example.com/v1"
                sx={{ width: '100%' }}
              />
            </FormControl>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <Button variant="primary" onClick={() => handleSave(provider)}>Save</Button>
              {exists && (
                <Button variant="danger" onClick={() => handleDelete(provider)}>Delete</Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default SettingsPanel;

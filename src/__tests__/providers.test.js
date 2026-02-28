import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMProvider } from '../providers/base.js';
import { OpenRouterProvider } from '../providers/openrouter.js';
import { OpenAIProvider } from '../providers/openai.js';
import { createProvider, PROVIDERS, PROVIDER_NAMES } from '../providers/index.js';

describe('LLMProvider base class', () => {
  it('stores apiKey and baseUrl', () => {
    const p = new LLMProvider('key123', 'https://api.example.com');
    expect(p.apiKey).toBe('key123');
    expect(p.baseUrl).toBe('https://api.example.com');
  });

  it('throws on name access', () => {
    const p = new LLMProvider('key', 'url');
    expect(() => p.name).toThrow('not implemented');
  });

  it('throws on chatCompletion', async () => {
    const p = new LLMProvider('key', 'url');
    await expect(p.chatCompletion({})).rejects.toThrow('not implemented');
  });

  it('throws on listModels', async () => {
    const p = new LLMProvider('key', 'url');
    await expect(p.listModels()).rejects.toThrow('not implemented');
  });
});

describe('OpenRouterProvider', () => {
  it('sets correct base URL and name', () => {
    const p = new OpenRouterProvider('test-key');
    expect(p.name).toBe('openrouter');
    expect(p.baseUrl).toBe('https://openrouter.ai/api/v1');
    expect(p.apiKey).toBe('test-key');
  });

  it('calls chat completions endpoint correctly', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Hello!' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    // Mock window.location for the referer header
    const originalWindow = global.window;
    global.window = { location: { origin: 'http://localhost:3000' } };

    const p = new OpenRouterProvider('test-key');
    const result = await p.chatCompletion({
      model: 'openai/gpt-4',
      messages: [{ role: 'user', content: 'Hi' }],
      temperature: 0.7,
      maxTokens: 100,
    });

    expect(result.content).toBe('Hello!');
    expect(result.tokensInput).toBe(10);
    expect(result.tokensOutput).toBe(5);
    expect(typeof result.latencyMs).toBe('number');

    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Authorization']).toBe('Bearer test-key');
    expect(opts.headers['X-Title']).toBe('LLM Explorer');

    const body = JSON.parse(opts.body);
    expect(body.model).toBe('openai/gpt-4');
    expect(body.max_tokens).toBe(100);

    global.window = originalWindow;
  });

  it('throws on API error response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { message: 'Invalid API key' } }),
    });
    global.window = { location: { origin: 'http://localhost' } };

    const p = new OpenRouterProvider('bad-key');
    await expect(
      p.chatCompletion({ model: 'x', messages: [], temperature: 1, maxTokens: 10 })
    ).rejects.toThrow('Invalid API key');
  });

  it('lists and sorts models', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            { id: 'b-model', name: 'Beta', context_length: 4096, pricing: {} },
            { id: 'a-model', name: 'Alpha', context_length: 8192, pricing: {} },
          ],
        }),
    });

    const p = new OpenRouterProvider('key');
    const models = await p.listModels();

    expect(models).toHaveLength(2);
    expect(models[0].name).toBe('Alpha');
    expect(models[1].name).toBe('Beta');
    expect(models[0].contextLength).toBe(8192);
  });
});

describe('OpenAIProvider', () => {
  it('sets correct defaults', () => {
    const p = new OpenAIProvider('key');
    expect(p.name).toBe('openai');
    expect(p.baseUrl).toBe('https://api.openai.com/v1');
  });

  it('accepts custom base URL', () => {
    const p = new OpenAIProvider('key', 'https://custom.api.com/v1');
    expect(p.baseUrl).toBe('https://custom.api.com/v1');
  });

  it('calls chat completions', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Reply' } }],
          usage: { prompt_tokens: 5, completion_tokens: 3 },
        }),
    });

    const p = new OpenAIProvider('key');
    const result = await p.chatCompletion({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'test' }],
      temperature: 1,
      maxTokens: 50,
    });

    expect(result.content).toBe('Reply');
    expect(result.tokensInput).toBe(5);
    expect(result.tokensOutput).toBe(3);
  });

  it('lists models with null context/pricing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: 'gpt-4' }, { id: 'gpt-3.5' }] }),
    });

    const p = new OpenAIProvider('key');
    const models = await p.listModels();

    expect(models).toHaveLength(2);
    expect(models[0]).toEqual({ id: 'gpt-4', name: 'gpt-4', contextLength: null, pricing: null });
  });
});

describe('Provider registry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exports correct provider names', () => {
    expect(PROVIDER_NAMES).toContain('openrouter');
    expect(PROVIDER_NAMES).toContain('openai');
  });

  it('maps names to classes', () => {
    expect(PROVIDERS.openrouter).toBe(OpenRouterProvider);
    expect(PROVIDERS.openai).toBe(OpenAIProvider);
  });

  it('creates providers by name', () => {
    const p = createProvider('openrouter', 'key123');
    expect(p).toBeInstanceOf(OpenRouterProvider);
    expect(p.apiKey).toBe('key123');
  });

  it('throws for unknown provider', () => {
    expect(() => createProvider('unknown', 'key')).toThrow('Unknown provider: unknown');
  });

  it('passes baseUrl to OpenAI provider', () => {
    const p = createProvider('openai', 'key', 'https://custom.com/v1');
    expect(p.baseUrl).toBe('https://custom.com/v1');
  });
});

import { LLMProvider } from './base.js';

export class OpenAIProvider extends LLMProvider {
  constructor(apiKey, baseUrl = 'https://api.openai.com/v1') {
    super(apiKey, baseUrl);
  }

  get name() {
    return 'openai';
  }

  async chatCompletion({ model, messages, temperature, maxTokens }) {
    const start = performance.now();
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    });
    const latencyMs = performance.now() - start;

    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error?.message || data.error || `Request failed with status ${response.status}`);
    }

    return {
      content: data.choices[0].message.content,
      tokensInput: data.usage.prompt_tokens,
      tokensOutput: data.usage.completion_tokens,
      latencyMs,
    };
  }

  async listModels() {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    });
    const data = await response.json();

    return data.data.map((model) => ({
      id: model.id,
      name: model.id,
      contextLength: null,
      pricing: null,
    }));
  }
}

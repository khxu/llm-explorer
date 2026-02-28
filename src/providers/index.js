import { OpenRouterProvider } from './openrouter.js';
import { OpenAIProvider } from './openai.js';

export const PROVIDERS = {
  openrouter: OpenRouterProvider,
  openai: OpenAIProvider,
};

export const PROVIDER_NAMES = Object.keys(PROVIDERS);

export function createProvider(providerName, apiKey, baseUrl) {
  const ProviderClass = PROVIDERS[providerName];
  if (!ProviderClass) {
    throw new Error(`Unknown provider: ${providerName}`);
  }
  return new ProviderClass(apiKey, baseUrl);
}

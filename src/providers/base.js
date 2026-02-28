export class LLMProvider {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  get name() {
    throw new Error('name not implemented');
  }

  // eslint-disable-next-line no-unused-vars
  async chatCompletion(_options) {
    throw new Error('chatCompletion not implemented');
  }

  async listModels() {
    throw new Error('listModels not implemented');
  }
}

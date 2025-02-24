const OpenAI = require("openai");

class OpenAIClient {
  constructor(apiKey) {
    this.client = new OpenAI({
      apiKey: apiKey, // Ensure your API key is provided
    });
  }

  // Wrapper method for chat completion
  async createChatCompletion(options) {
    return await this.client.chat.completions.create(options);
  }
}

module.exports = OpenAIClient;

import { getApiEndpoints, fetchApi } from '../config';

export interface OllamaStatus {
  online: boolean;
  url: string;
  models: string[];
  default_model?: string;
  error?: string;
}

export interface ChatResult {
  reply: string;
  model: string;
  error?: string;
}

export class OllamaClient {
  private defaultModel = 'llama3.2';

  async getStatus(): Promise<OllamaStatus> {
    try {
      const endpoints = getApiEndpoints();
      const resp = await fetchApi(endpoints.ollamaStatus, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.default_model) {
        this.defaultModel = data.default_model;
      }
      return data;
    } catch (e) {
      return {
        online: false,
        url: 'http://localhost:11434',
        models: [],
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async generateResponse(
    prompt: string,
    model?: string,
    systemPrompt?: string
  ): Promise<ChatResult> {
    const targetModel = model || this.defaultModel;

    try {
      const endpoints = getApiEndpoints();
      const resp = await fetchApi(endpoints.chat, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: targetModel,
          system_prompt: systemPrompt,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Chat request failed (${resp.status}): ${errText}`);
      }

      const data = await resp.json();
      return {
        reply: data.reply,
        model: data.model || targetModel,
        error: data.error,
      };
    } catch (err) {
      console.warn('[ollamaClient] Error querying Ollama via backend:', err);
      return {
        reply: `I could not reach Ollama. Please make sure Ollama is running ('ollama serve') and the model '${targetModel}' is downloaded.`,
        model: targetModel,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

export const ollamaClient = new OllamaClient();

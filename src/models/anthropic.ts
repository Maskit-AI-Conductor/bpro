/**
 * Anthropic (Claude) adapter.
 */

import type { ModelAdapter, GenerateOptions } from './adapter.js';
import { parseJsonResponse } from '../utils/json-repair.js';

export class AnthropicAdapter implements ModelAdapter {
  name: string;
  provider = 'anthropic';
  private model: string;
  private apiKey: string;
  private defaultTimeout: number;

  constructor(name: string, model: string, apiKey: string, timeout = 120) {
    this.name = name;
    this.model = model;
    this.apiKey = apiKey;
    this.defaultTimeout = timeout;
  }

  async checkHealth(): Promise<boolean> {
    // Simple check: verify API key is set
    return Boolean(this.apiKey);
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    const timeout = (options?.timeout ?? this.defaultTimeout) * 1000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const payload: Record<string, unknown> = {
      model: this.model,
      max_tokens: options?.maxTokens ?? 4096,
      messages: [{ role: 'user', content: prompt }],
    };
    if (options?.system) {
      payload.system = options.system;
    }
    if (options?.temperature !== undefined) {
      payload.temperature = options.temperature;
    }

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Anthropic API error ${resp.status}: ${text}`);
      }

      const data = await resp.json() as { content?: Array<{ type: string; text?: string }> };
      const textBlock = data.content?.find((b) => b.type === 'text');
      return textBlock?.text ?? '';
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Anthropic API timed out after ${this.defaultTimeout}s`);
      }
      throw err;
    }
  }

  async generateJSON<T = unknown>(prompt: string, options?: GenerateOptions): Promise<T> {
    const raw = await this.generate(prompt, options);
    return parseJsonResponse<T>(raw);
  }
}

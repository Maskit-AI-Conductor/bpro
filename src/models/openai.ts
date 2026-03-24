/**
 * OpenAI (GPT) adapter.
 */

import type { ModelAdapter, GenerateOptions } from './adapter.js';
import { parseJsonResponse } from '../utils/json-repair.js';

export class OpenAIAdapter implements ModelAdapter {
  name: string;
  provider = 'openai';
  private model: string;
  private apiKey: string;
  private endpoint: string;
  private defaultTimeout: number;

  constructor(
    name: string,
    model: string,
    apiKey: string,
    endpoint = 'https://api.openai.com/v1',
    timeout = 120,
  ) {
    this.name = name;
    this.model = model;
    this.apiKey = apiKey;
    this.endpoint = endpoint.replace(/\/$/, '');
    this.defaultTimeout = timeout;
  }

  async checkHealth(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    const timeout = (options?.timeout ?? this.defaultTimeout) * 1000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const messages: Array<{ role: string; content: string }> = [];
    if (options?.system) {
      messages.push({ role: 'system', content: options.system });
    }
    messages.push({ role: 'user', content: prompt });

    const payload: Record<string, unknown> = {
      model: this.model,
      messages,
    };
    if (options?.maxTokens) payload.max_tokens = options.maxTokens;
    if (options?.temperature !== undefined) payload.temperature = options.temperature;
    if (options?.jsonMode) payload.response_format = { type: 'json_object' };

    try {
      const resp = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`OpenAI API error ${resp.status}: ${text}`);
      }

      const data = await resp.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content ?? '';
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`OpenAI API timed out after ${this.defaultTimeout}s`);
      }
      throw err;
    }
  }

  async generateJSON<T = unknown>(prompt: string, options?: GenerateOptions): Promise<T> {
    const raw = await this.generate(prompt, { ...options, jsonMode: true });
    return parseJsonResponse<T>(raw);
  }
}

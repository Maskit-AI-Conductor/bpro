/**
 * Google Gemini adapter.
 */

import type { ModelAdapter, GenerateOptions } from './adapter.js';
import { parseJsonResponse } from '../utils/json-repair.js';

export class GeminiAdapter implements ModelAdapter {
  name: string;
  provider = 'gemini';
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
    return Boolean(this.apiKey);
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    const timeout = (options?.timeout ?? this.defaultTimeout) * 1000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const payload: Record<string, unknown> = {
      contents: [{ parts: [{ text: prompt }] }],
    };
    if (options?.system) {
      payload.systemInstruction = { parts: [{ text: options.system }] };
    }
    if (options?.temperature !== undefined) {
      payload.generationConfig = { temperature: options.temperature };
    }
    if (options?.maxTokens) {
      payload.generationConfig = {
        ...(payload.generationConfig as Record<string, unknown> ?? {}),
        maxOutputTokens: options.maxTokens,
      };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Gemini API error ${resp.status}: ${text}`);
      }

      const data = await resp.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Gemini API timed out after ${this.defaultTimeout}s`);
      }
      throw err;
    }
  }

  async generateJSON<T = unknown>(prompt: string, options?: GenerateOptions): Promise<T> {
    const raw = await this.generate(prompt, options);
    return parseJsonResponse<T>(raw);
  }
}

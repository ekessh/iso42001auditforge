// SPDX-License-Identifier: BUSL-1.1
import type { ZodSchema } from 'zod';
import type {
  CompletionOpts,
  CompletionResult,
  LLMProvider,
  ProviderCapabilities,
  ProviderMetadata,
  ReasoningResult,
} from '../types.js';
import { StructuredParseError } from '../errors.js';
import type { PromptTemplateRegistry } from '../templates/registry.js';

export interface BaseProviderConfig {
  templates: PromptTemplateRegistry;
}

export abstract class BaseProvider implements LLMProvider {
  protected constructor(private readonly base: BaseProviderConfig) {}

  abstract metadata(): ProviderMetadata;
  abstract isCloud(): boolean;
  abstract capabilities(): ProviderCapabilities;
  abstract complete(prompt: string, opts: CompletionOpts): Promise<CompletionResult>;
  abstract embed(text: string | string[], opts?: { model?: string }): Promise<number[][]>;

  protected ensureTemplate(version: string): void {
    this.base.templates.ensure(version);
  }

  async classifyStructured<T>(
    prompt: string,
    schema: ZodSchema<T>,
    opts: CompletionOpts,
  ): Promise<T> {
    this.ensureTemplate(opts.promptTemplateVersion);
    const maxAttempts = 3;
    let lastError = '';
    for (let i = 0; i < maxAttempts; i++) {
      const result = await this.complete(prompt, opts);
      const parsedJson = tryParseJson(result.output);
      if (parsedJson === null) {
        lastError = 'output was not valid JSON';
        continue;
      }
      const parsed = schema.safeParse(parsedJson);
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues.map((i) => i.message).join(' | ');
    }
    throw new StructuredParseError(this.metadata().provider, maxAttempts, lastError);
  }

  async reasonStructured<T>(
    prompt: string,
    schema: ZodSchema<T>,
    opts: CompletionOpts & { effortLevel?: 'low' | 'medium' | 'high' },
  ): Promise<ReasoningResult<T>> {
    this.ensureTemplate(opts.promptTemplateVersion);
    const cot = await this.complete(buildCotPrompt(prompt), opts);
    const { reasoning, answerJson } = splitCotOutput(cot.output);
    const parsedJson = tryParseJson(answerJson);
    if (parsedJson === null) {
      throw new StructuredParseError(this.metadata().provider, 1, 'no JSON answer found');
    }
    const parsed = schema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new StructuredParseError(
        this.metadata().provider,
        1,
        parsed.error.issues.map((i) => i.message).join(' | '),
      );
    }
    return { value: parsed.data, reasoningTrace: reasoning, raw: cot };
  }
}

function tryParseJson(s: string): unknown | null {
  try {
    return JSON.parse(s);
  } catch {
    const match = s.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function buildCotPrompt(prompt: string): string {
  return `${prompt}

Respond in two sections, in this exact order:
1. <reasoning>...your step by step thinking...</reasoning>
2. <answer>...JSON answer only, no prose...</answer>`;
}

function splitCotOutput(output: string): { reasoning: string; answerJson: string } {
  const r = output.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
  const a = output.match(/<answer>([\s\S]*?)<\/answer>/);
  return {
    reasoning: r ? r[1]!.trim() : '',
    answerJson: a ? a[1]!.trim() : output.trim(),
  };
}

export const __testing = { tryParseJson, buildCotPrompt, splitCotOutput };
